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

console.log('Testing Vapi API endpoint...');
console.log('URL: http://localhost:3000/api/vapi');
console.log('Test data:', JSON.stringify(testData, null, 2));
console.log('---');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:');
    try {
      console.log(JSON.stringify(JSON.parse(data), null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
  console.log('---');
  console.log('Make sure your Next.js dev server is running on port 3000!');
  console.log('Start it with: npm run dev');
});

req.write(postData);
req.end();
