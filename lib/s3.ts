import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint =
  process.env.AWS_ENDPOINT_URL_S3 ||
  "https://br-delicate-fog-b43acua1.storage.c-6.us-east-2.aws.neon.tech";
const accessKeyId =
  process.env.AWS_ACCESS_KEY_ID ||
  "nak_live_2401f9f845d24971bd42dfd023808841";
const secretAccessKey =
  process.env.AWS_SECRET_ACCESS_KEY ||
  "nsk_live_08cd55ee9a60f0f4126ece6be72e91042c4324462eca08bf0704153574c24c5a";
const region = process.env.AWS_REGION || "us-east-2";
export const S3_BUCKET = process.env.S3_BUCKET_NAME || "assets";

export const s3Client = new S3Client({
  endpoint,
  region,
  credentials:
    accessKeyId && secretAccessKey
      ? {
          accessKeyId,
          secretAccessKey,
        }
      : undefined,
  forcePathStyle: true,
});

/**
 * Uploads a buffer or string to Neon S3 storage
 */
export async function uploadToS3(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string = "application/octet-stream"
) {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3Client.send(command);
  return key;
}

/**
 * Generates a pre-signed view URL for an object stored in S3
 */
export async function getFileSignedUrl(key: string, expiresIn: number = 3600) {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}
