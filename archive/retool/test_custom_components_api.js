// Test Custom Component Library API with proper headers
const API_TOKEN = 'retool_01k1hs3x1y7a9vxds3hatcd7xh';

async function testCustomComponentAPI() {
  console.log('Testing Custom Component Library API with all headers...\n');

  // Test with different header combinations
  const tests = [
    {
      name: 'Standard headers',
      url: 'https://api.retool.com/api/v2/custom-component-libraries',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    },
    {
      name: 'With API version header',
      url: 'https://api.retool.com/api/v2/custom-component-libraries',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Version': '2.0'
      }
    },
    {
      name: 'Alternative endpoint (no s)',
      url: 'https://api.retool.com/api/v2/custom-component-library',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    },
    {
      name: 'With organization header',
      url: 'https://api.retool.com/api/v2/custom-component-library',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Organization': 'leonardolech1'
      }
    }
  ];

  for (const test of tests) {
    console.log(`\nTesting: ${test.name}`);
    console.log(`URL: ${test.url}`);
    
    try {
      const response = await fetch(test.url, {
        method: 'GET',
        headers: test.headers
      });
      
      console.log(`Status: ${response.status}`);
      
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        console.log('Response:', JSON.stringify(data, null, 2));
      } catch {
        console.log('Response:', text);
      }
      
      // Log response headers
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
    } catch (error) {
      console.log('Error:', error.message);
    }
  }
  
  // Try creating a simple component
  console.log('\n\nAttempting to CREATE a custom component...');
  
  const componentData = {
    name: 'TestComponent',
    description: 'Simple test component',
    code: 'return () => React.createElement("div", {}, "Hello World");'
  };
  
  try {
    const response = await fetch('https://api.retool.com/api/v2/custom-component-library', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(componentData)
    });
    
    console.log(`Create Status: ${response.status}`);
    const result = await response.json();
    console.log('Create Response:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.log('Create Error:', error.message);
  }
}

testCustomComponentAPI();