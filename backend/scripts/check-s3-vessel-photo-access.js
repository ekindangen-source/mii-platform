require("dotenv").config({
  override: true,
});

const {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3");

const region =
  process.env.AWS_REGION || "ap-southeast-2";

const bucket =
  process.env.S3_VESSEL_PHOTO_BUCKET ||
  "mii-s3-bucket-875981964442-ap-southeast-2-an";

const key =
  `vessels/_healthcheck/${Date.now()}.txt`;

const s3 = new S3Client({ region });

(async () => {
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from("MII S3 access check"),
        ContentType: "text/plain",
        ServerSideEncryption: "AES256",
      })
    );

    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    console.log(
      "S3 vessel photo access is working."
    );
  } catch (error) {
    console.error(
      "S3 access check failed:",
      error.message
    );
    process.exitCode = 1;
  }
})();
