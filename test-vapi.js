// Simple test script to verify the Vapi API endpoint works
// You can run this with: node test-vapi.js

const http = require('http');

// Test the queryMeetings function
const testData = {
  message: {
    functionCall: {
      name: "queryMeetings",
      parameters: {
        date: "today"
      }
    }
  }
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/vapi',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};


const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    // Response received
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

req.write(postData);
req.end();
