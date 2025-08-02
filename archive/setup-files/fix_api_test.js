// Test different API approaches for Business plan
const API_TOKEN = 'retool_01k1hs3x1y7a9vxds3hatcd7xh';

async function testAPIApproaches() {
  console.log('Testing different API approaches...\n');

  // Test 1: Standard API endpoint
  console.log('1. Testing standard API endpoint:');
  try {
    const response = await fetch('https://api.retool.com/api/v2/custom-component-library', {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Accept': 'application/json'
      }
    });
    const data = await response.json();
    console.log('   Status:', response.status);
    console.log('   Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 2: Instance-specific endpoint
  console.log('\n2. Testing instance-specific endpoint:');
  try {
    const response = await fetch('https://leonardolech1.retool.com/api/v2/custom-component-library', {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Accept': 'application/json'
      }
    });
    const data = await response.json();
    console.log('   Status:', response.status);
    console.log('   Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 3: Try user invites (should work on Business)
  console.log('\n3. Testing user invites endpoint (Business plan feature):');
  try {
    const response = await fetch('https://api.retool.com/api/v2/user-invites', {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Accept': 'application/json'
      }
    });
    const data = await response.json();
    console.log('   Status:', response.status);
    console.log('   Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 4: Check token info
  console.log('\n4. Testing basic auth (to verify token):');
  try {
    const response = await fetch('https://api.retool.com/api/v2/', {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Accept': 'application/json'
      }
    });
    console.log('   Status:', response.status);
    console.log('   Headers:', Object.fromEntries(response.headers.entries()));
  } catch (error) {
    console.log('   Error:', error.message);
  }

  console.log('\n\nPossible solutions:');
  console.log('1. Regenerate your API token with all available scopes');
  console.log('2. Contact Retool support - the error message may be outdated');
  console.log('3. Use the Custom Component (single) in the Retool editor instead');
  console.log('4. Check if your Business plan was recently activated and needs refresh');
}

testAPIApproaches();