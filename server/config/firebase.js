import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const serviceAccount = JSON.parse(fs.readFileSync("./serviceAccount.json", "utf-8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export const db = admin.firestore();
export const auth = admin.auth();
