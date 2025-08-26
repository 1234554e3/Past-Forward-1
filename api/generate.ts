/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";

// NOTE: This file is intended to be deployed as a serverless function
// on a platform like Vercel or Netlify. It will not run in the browser.

// The API key is securely read from environment variables on the server.
const API_KEY = process.env.API_KEY;

// This is the main handler for the serverless function.
// Vercel automatically maps this file to the `/api/generate` endpoint.
export default async function handler(req: Request): Promise<Response> {
    if (!API_KEY) {
        console.error("API_KEY environment variable is not set on the server.");
        return new Response(JSON.stringify({ error: "Server configuration error: API key not found." }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const { imageDataUrl, prompt } = await req.json();

        if (!imageDataUrl || !prompt) {
            return new Response(JSON.stringify({ error: 'Missing required body parameters: imageDataUrl, prompt' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const ai = new GoogleGenAI({ apiKey: API_KEY });

        const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
        if (!match) {
            return new Response(JSON.stringify({ error: "Invalid image data URL format." }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        const mimeType = match[1];
        const base64Data = match[2];

        const imagePart = { inlineData: { mimeType, data: base64Data } };
        const textPart = { text: prompt };

        // Retry logic now lives on the server for robustness.
        const maxRetries = 3;
        const initialDelay = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response: GenerateContentResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image-preview',
                    contents: { parts: [imagePart, textPart] },
                });

                const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

                if (imagePartFromResponse?.inlineData) {
                    const { mimeType, data } = imagePartFromResponse.inlineData;
                    const url = `data:${mimeType};base64,${data}`;
                    return new Response(JSON.stringify({ url }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                
                const textResponse = response.text;
                throw new Error(`The AI model responded with text instead of an image: "${textResponse || 'No text response received.'}"`);

            } catch (error) {
                console.error(`Error on attempt ${attempt}/${maxRetries}:`, error);
                
                const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
                const isInternalError = errorMessage.includes('"code":500') || errorMessage.includes('INTERNAL');

                if (isInternalError && attempt < maxRetries) {
                    const delay = initialDelay * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                throw error;
            }
        }
        
        throw new Error("Failed to generate image after all retries.");

    } catch (error) {
        console.error("Serverless function handler error:", error);
        const message = error instanceof Error ? error.message : "An unknown server error occurred";
        return new Response(JSON.stringify({ error: `The AI model failed to generate an image. Details: ${message}` }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
