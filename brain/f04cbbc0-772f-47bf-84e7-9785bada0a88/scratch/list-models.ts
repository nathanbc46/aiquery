import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { join } from 'path';

dotenv.config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY not found in .env');
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    console.log('--- Fetching Available Models ---');
    
    // In SDK v0.21.0, we can iterate through the list of models
    // Note: The method might vary slightly depending on the SDK version, 
    // but we'll try the common approach.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();

    if (data.models) {
      console.log('Available Models:');
      data.models.forEach((m: any) => {
        if (m.supportedGenerationMethods.includes('generateContent')) {
          console.log(`- ${m.name} (Supported)`);
        } else {
          console.log(`- ${m.name}`);
        }
      });
    } else {
      console.log('No models found or error in response:', data);
    }
  } catch (error) {
    console.error('Error fetching models:', error);
  }
}

listModels();
