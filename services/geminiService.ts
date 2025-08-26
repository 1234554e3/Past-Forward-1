/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Generates a decade-styled image by calling our own secure backend endpoint.
 * This function runs in the browser and does not handle the API key directly.
 * @param imageDataUrl A data URL string of the source image (e.g., 'data:image/png;base64,...').
 * @param prompt The prompt to guide the image generation.
 * @returns A promise that resolves to a base64-encoded image data URL of the generated image.
 */
export async function generateDecadeImage(imageDataUrl: string, prompt: string): Promise<string> {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageDataUrl, prompt }),
    });

    const result = await response.json();

    if (!response.ok) {
      // The backend provides a helpful error message in the 'error' field.
      throw new Error(result.error || `Server responded with status ${response.status}`);
    }

    if (!result.url) {
        throw new Error("Server response did not include an image URL.");
    }
    
    return result.url;
  } catch (error) {
    console.error("Error calling backend API:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred while communicating with the server.";
    // Re-throw the error so the UI can catch it and display a message.
    throw new Error(message);
  }
}
