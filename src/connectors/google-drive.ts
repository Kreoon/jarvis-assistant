import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { getGoogleAccessToken } from '../shared/google-api.js';
import { agentLogger } from '../shared/logger.js';

const logger = agentLogger('google-drive');

interface AccessTokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: AccessTokenCache | null = null;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();

  if (tokenCache && tokenCache.expiresAt > now) {
    return tokenCache.token;
  }

  logger.info('Exchanging refresh token for access token');

  const access_token = await getGoogleAccessToken('founder');

  tokenCache = {
    token: access_token,
    expiresAt: now + (50 * 60 * 1000),
  };

  logger.info('Access token obtained and cached for 50 minutes');

  return access_token;
}

export async function uploadToDrive(options: {
  filePath: string;
  fileName: string;
  mimeType: string;
  folderId: string;
}): Promise<{ fileId: string; webViewLink: string }> {
  const { filePath, fileName, mimeType, folderId } = options;

  logger.info({ fileName, mimeType, folderId }, 'Uploading file to Google Drive');

  const accessToken = await getAccessToken();

  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const form = new FormData();
  form.append('metadata', JSON.stringify(metadata), {
    contentType: 'application/json',
  });
  form.append('file', fs.createReadStream(filePath), {
    filename: fileName,
    contentType: mimeType,
  });

  const uploadResponse = await axios.post(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    form,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...form.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    }
  );

  const fileId: string = uploadResponse.data.id;
  let webViewLink: string = uploadResponse.data.webViewLink;

  logger.info({ fileId }, 'File uploaded, setting public permission');

  await axios.post(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    {
      role: 'reader',
      type: 'anyone',
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!webViewLink) {
    webViewLink = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
  }

  logger.info({ fileId, webViewLink }, 'File uploaded and permission set successfully');

  return { fileId, webViewLink };
}

export async function uploadMediaToDrive(
  filePath: string,
  fileName: string,
  mimeType: string
): Promise<{ fileId: string; webViewLink: string }> {
  const folderId = process.env.DRIVE_FOLDER_MEDIA;

  if (!folderId) {
    throw new Error('DRIVE_FOLDER_MEDIA environment variable is not set');
  }

  return uploadToDrive({ filePath, fileName, mimeType, folderId });
}

export async function uploadReportToDrive(
  filePath: string,
  fileName: string
): Promise<{ fileId: string; webViewLink: string }> {
  const folderId = process.env.DRIVE_FOLDER_REPORTES;

  if (!folderId) {
    throw new Error('DRIVE_FOLDER_REPORTES environment variable is not set');
  }

  return uploadToDrive({
    filePath,
    fileName,
    mimeType: 'application/pdf',
    folderId,
  });
}

export async function deleteLocalFile(filePath: string): Promise<void> {
  const absolutePath = path.resolve(filePath);

  logger.info({ filePath: absolutePath }, 'Deleting local file');

  await fs.promises.unlink(absolutePath);

  logger.info({ filePath: absolutePath }, 'Local file deleted');
}
