const crypto = require("crypto");

const {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3");
const {
  getSignedUrl,
} = require("@aws-sdk/s3-request-presigner");

const AWS_REGION =
  process.env.AWS_REGION || "ap-southeast-2";
const S3_BUCKET =
  process.env.S3_INTERACTION_PHOTO_BUCKET ||
  process.env.S3_VESSEL_PHOTO_BUCKET ||
  "mii-s3-bucket-875981964442-ap-southeast-2-an";

const s3 = new S3Client({
  region: AWS_REGION,
});

function safeSegment(value) {
  return String(value || "unknown").replace(
    /[^A-Za-z0-9._-]/g,
    "_"
  );
}

function isS3ObjectKey(photoPath) {
  const value = String(photoPath || "");

  return (
    Boolean(value) &&
    !value.startsWith("/") &&
    !/^https?:\/\//i.test(value)
  );
}

async function uploadInteractionPhoto({
  customerId,
  interactionId,
  buffer,
  mimeType,
  extension,
}) {
  const key =
    `interactions/${safeSegment(customerId)}/` +
    `${safeSegment(interactionId)}/` +
    `${crypto.randomUUID()}${extension}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ServerSideEncryption: "AES256",
      CacheControl: "private, max-age=31536000",
    })
  );

  return key;
}

async function deleteInteractionPhoto(photoPath) {
  if (!isS3ObjectKey(photoPath)) {
    return false;
  }

  await s3.send(
    new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: photoPath,
    })
  );

  return true;
}

async function getInteractionPhotoUrl(
  photoPath,
  expiresInSeconds = 900
) {
  if (!isS3ObjectKey(photoPath)) {
    return null;
  }

  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: photoPath,
    }),
    {
      expiresIn: expiresInSeconds,
    }
  );
}

async function addInteractionPhotoUrl(record) {
  if (!record) {
    return record;
  }

  if (!isS3ObjectKey(record.photo_path)) {
    return {
      ...record,
      photo_url: null,
    };
  }

  try {
    return {
      ...record,
      photo_url: await getInteractionPhotoUrl(
        record.photo_path
      ),
    };
  } catch (error) {
    console.error(
      "Unable to create interaction photo URL:",
      error.message
    );

    return {
      ...record,
      photo_url: null,
    };
  }
}

module.exports = {
  AWS_REGION,
  S3_BUCKET,
  addInteractionPhotoUrl,
  deleteInteractionPhoto,
  getInteractionPhotoUrl,
  isS3ObjectKey,
  uploadInteractionPhoto,
};
