var zlib = require('zlib');
var fs = require('fs');
var {google} = require('googleapis');
var rp = require('request-promise');
var axios = require('axios');

var PROJECT_ID = 'reimbursify';
var HOST = 'firebaseremoteconfig.googleapis.com';
var PATH = '/v1/projects/' + PROJECT_ID + '/remoteConfig';
var SCOPE = 'https://www.googleapis.com/auth/firebase.remoteconfig';

function getAccessToken() {
    return new Promise(function(resolve, reject) {
      var key = require('./service-account.json');
      var jwtClient = new google.auth.JWT(
        key.client_email,
        null,
        key.private_key,
        [SCOPE],
        null
      );
      jwtClient.authorize(function(err, tokens) {
        if (err) {
          reject(err);
          return;
        }
        resolve(tokens.access_token);
      });
    });
  }
  
  /**
   * Retrieve the current Firebase Remote Config template from the server. Once
   * retrieved the template is stored locally in a file named `config.json`.
   */
  function getTemplate() {
    return getAccessToken().then(function(accessToken) {
      console.log(accessToken);
      return new Promise((resolve, reject)=>{
        axios({
          url:`https://${HOST+PATH}`,
          method : 'get',
          headers:{
            'Authorization':`Bearer ${accessToken}`,
            'Accept-Encoding': 'gzip'
          }
        }).then((response)=>{
          var etag = response.headers['etag'];
          console.log('ETag from server: ' + etag);
          console.log(JSON.stringify(response.data));
          resolve(response.body);
        }).catch((err)=>{
          console.log('Unable to get template.');
          reject(null);
        });
      });
  });
}
  
  /**
   * Publish the local template stored in `config.json` to the server.
   *
   * @param {String} etag ETag must be supplied when publishing a template. This is to
   *                      avoid race conditions when publishing.
   */
  function publishTemplate(etag) {
    getAccessToken().then(function(accessToken) {
      var options = {
        hostname: HOST,
        path: PATH,
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json; UTF-8',
          'Accept-Encoding': 'gzip',
          'If-Match': etag
        }
      }
  
      var request = https.request(options, function(resp) {
        if (resp.statusCode == 200) {
          var newEtag = resp.headers['etag'];
          console.log('Template has been published');
          console.log('ETag from server: ' + newEtag);
        } else {
          console.log('Unable to publish template.');
          console.log(resp.error);
        }
      });
  
      request.on('error', function(err) {
        console.log('Request to send configuration template failed.');
        console.log(err);
      });
  
      request.write(fs.readFileSync('config.json', 'UTF8'));
      request.end();
    });
  }
  
  var action = process.argv[2];
  var etag = process.argv[3];
  
  if (action && action == 'get') {
    getTemplate();
  } else if (action && action == 'publish' && etag) {
    publishTemplate(etag);
  } else {
    console.log('Invalid command. Please use one of the following:\n'
        + 'node index.js get\n'
        + 'node index.js publish <LATEST_ETAG>');
  }