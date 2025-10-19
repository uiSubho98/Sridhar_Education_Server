import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";

dotenv.config();

const s3 = new S3Client({
  region: process.env.AR,
  credentials: {
    accessKeyId: process.env.AAK,
    secretAccessKey: process.env.ASK,
  },
});

export const uploadToS3 = async ({
  folderName,
  file,
  fileName,
  ContentType,
}) => {
  const bucket = process.env.ABN;
  const key = `${folderName}/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file,
    ContentType: ContentType,
  });

  await s3.send(command);
  return key; // Store only the key
};

export const deleteFromS3 = async (fileKey) => {
  const bucket = process.env.ABN;

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: fileKey,
  });

  await s3.send(command);
};

export const getPresignedUrl = async (fileKey, expiresIn = 3600) => {
  const command = new GetObjectCommand({
    Bucket: process.env.ABN,
    Key: fileKey,
  });

  return await getSignedUrl(s3, command, { expiresIn });
};
