import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
  ListObjectsV2CommandOutput,
  _Object,
  GetObjectOutput,
} from "@aws-sdk/client-s3";
import { simpleParser, ParsedMail } from "mailparser";

export interface EmailData {
  from: string;
  to: string;
  send_date: Date;
  subject: string;
  body: string;
  s3_key: string;
  whitelistedLinks?: string[];
}

export default class EmailFetcher {
  private bucket: string;
  private prefix: string;
  private s3Client: S3Client;
  private recipient: string;

  constructor(recipient: string, bucket: string, prefix: string = "", region: string = "eu-west-2") {
    this.bucket = bucket;
    this.prefix = prefix;
    this.s3Client = new S3Client({ region });
    this.recipient = recipient;
  }

  async getLatestEmail(limit: number = 100): Promise<EmailData | undefined> {
    let allContents: _Object[] = [];
    const listCommand = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: this.prefix,
      MaxKeys: limit,
    });
    const response: ListObjectsV2CommandOutput = await this.s3Client.send(listCommand);
    if (response.Contents) {
      allContents = response.Contents;
    }
    if (allContents.length === 0) return undefined;

    allContents.sort(
      (a, b) => new Date(b.LastModified!).getTime() - new Date(a.LastModified!).getTime(),
    );

    let email: EmailData | undefined;
    for (const obj of allContents) {
      const emailData = await this._fetchAndParseEmail(obj.Key!);
      if (
        emailData &&
        emailData.to.toLowerCase().includes(this.recipient.toLowerCase())
      ) {
        const code = this.extractCode(emailData);
        if (code) {
          emailData.code = code;
          email = emailData;
          break;
        }
      }
    }
    return email;
  }

  async deleteEmail(key: string): Promise<void> {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    try {
      await this.s3Client.send(deleteCommand);
    } catch (error) {
      console.error(`Error deleting email with key ${key}:`, error);
    }
  }

  private async _fetchAndParseEmail(key: string): Promise<EmailData | null> {
    const getCommand = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const response: GetObjectOutput = await this.s3Client.send(getCommand);
    const { Body } = response;
    if (!Body) {
      return null;
    }
    const chunks: Uint8Array[] = [];
    for await (const chunk of Body) {
      chunks.push(chunk);
    }
    const rawEmail = Buffer.concat(chunks).toString("utf-8");
    return this._parseMime(rawEmail, key);
  }

  private async _parseMime(rawEmail: string, key: string): Promise<EmailData | null> {
    try {
      const parsed: ParsedMail = await simpleParser(rawEmail);
      const from = parsed.from?.text || "Unknown";
      const to = parsed.to?.text || "Unknown";
      const subject = parsed.subject || "No Subject";
      const send_date = parsed.date || new Date();
      const body = parsed.html || parsed.textAsHtml || parsed.text || "";
      return { from, to, send_date, subject, body, s3_key: key };
    } catch (error) {
      console.error(`Error parsing MIME for ${key}:`, error);
      return null;
    }
  }

  private extractCode(emailObj: EmailData): string[] {
    if (!emailObj || !emailObj.body) return [];
    const codeRegex = /(\d{6})/;
    const emailCode: string[] = [...emailObj.body.matchAll(codeRegex)].map((m) => m[1])

    return emailCode;
  }
}
