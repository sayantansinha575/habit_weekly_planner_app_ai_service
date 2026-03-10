import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/analyze-meal';

async function testAnalysis() {
    const testCases = [
        {
            description: 'rice, chicken, broccoli',
            name: 'Basic Meal'
        },
        {
            description: 'grilled salmon with asparagus',
            name: 'Specific Meal'
        }
    ];

    for (const testCase of testCases) {
        console.log(`\n--- Testing: ${testCase.name} ---`);
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: testCase.description })
            });

            if (!response.ok) {
                console.error(`Error: ${response.status} - ${await response.text()}`);
                continue;
            }

            const result = await response.json();
            console.log('Result:', JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Test failed:', err.message);
        }
    }
}

testAnalysis();
