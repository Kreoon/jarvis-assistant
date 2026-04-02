/**
 * ElevenLabs streaming TTS client.
 * Communicates through the Jarvis backend proxy at /api/tts.
 */

export interface TTSRequestBody {
  text: string;
}

/**
 * Calls POST /api/tts and returns the full audio as an ArrayBuffer.
 */
export async function streamTTS(
  text: string,
  token: string,
  apiUrl: string
): Promise<ArrayBuffer> {
  const response = await fetch(`${apiUrl}/api/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text } satisfies TTSRequestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `TTS request failed: ${response.status} ${response.statusText} — ${errorText}`
    );
  }

  return response.arrayBuffer();
}

/**
 * Calls POST /api/tts and returns a ReadableStream for progressive playback.
 * The stream emits Uint8Array chunks of audio data.
 */
export async function streamTTSChunked(
  text: string,
  token: string,
  apiUrl: string
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(`${apiUrl}/api/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text } satisfies TTSRequestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `TTS stream request failed: ${response.status} ${response.statusText} — ${errorText}`
    );
  }

  if (!response.body) {
    throw new Error("TTS response body is null — streaming not supported");
  }

  return response.body;
}
