const ImageKit = require("imagekit");

// Storage abstraction: ImageKit today, swappable for S3/Azure later.
// Any code that needs to upload/delete media should go through this module,
// not call the ImageKit SDK directly elsewhere in the app.
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

/**
 * Upload a file buffer to ImageKit.
 * @param {Buffer} fileBuffer
 * @param {string} fileName
 * @param {string} folder - e.g. /abeis/cameraRecordings
 * @returns {Promise<object>} imagekit upload response
 */
async function uploadToStorage(fileBuffer, fileName, folder) {
  const result = await imagekit.upload({
    file: fileBuffer,
    fileName,
    folder,
    useUniqueFileName: true,
  });
  return result;
}

async function deleteFromStorage(fileId) {
  return imagekit.deleteFile(fileId);
}

module.exports = { imagekit, uploadToStorage, deleteFromStorage };
