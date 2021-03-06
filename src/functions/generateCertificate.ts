import chromium from "chrome-aws-lambda";
import { document } from "../utils/dynamodbClient";
import path from "path";
import fs from "fs";
import handlebars from "handlebars";
import dayjs from "dayjs";
import { S3 } from "aws-sdk";

interface ICreateCertificate {
  id: string;
  name: string;
  grade: string;
}

interface ITemplate extends ICreateCertificate{
  date: string;
  medal: string;
}

const compile = async function(data: ITemplate) {
  const filePath = path.join(process.cwd(), "src", "templates", "certificate.hbs");

  const html = fs.readFileSync(filePath, "utf-8");

  return handlebars.compile(html)(data);
}

export const handle = async (event) => {
  // id, name, grade
  const { id, name, grade } = JSON.parse(event.body) as ICreateCertificate;

  const response = await document.query({
    TableName: "users_certificates",
    KeyConditionExpression: "id = :id",
    ExpressionAttributeValues: {
      ":id": id
    }
  }).promise();

  const userAlreadyExists = response.Items[0];

  if(!userAlreadyExists) {
    await document.put({
      TableName: "users_certificates",
      Item: {
        id,
        name, 
        grade
      }
    }).promise();
  }


  //gera o certificado
  //compila handlebars

  const medalPath = path.join(process.cwd(), "src", "templates", "selo.png");
  const medal = fs.readFileSync(medalPath, "base64");

  const data: ITemplate = {
    date: dayjs().format("DD/MM/YYYY"),
    grade,
    name,
    id,
    medal
  };

  const content = await compile(data);

  //-> pdf
  const browser = await chromium.puppeteer.launch({
    headless: true,
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath
    // executablePath: "/usr/bin/chromium-browser"
  });

  const page = await browser.newPage();

  await page.setContent(content);

  const pdf = await page.pdf({
    format: "a4",
    landscape: true,
    path: process.env.IS_OFFLINE ? "certificate.pdf" : null,
    printBackground: true,
    preferCSSPageSize: true,
  });

  await browser.close();

  //salvar no s3

  const s3 = new S3();

  await s3.putObject({
    Bucket: "slscertificatesignite",
    Key: `${id}.pdf`,
    ACL: "public-read",
    Body: pdf,
    ContentType: "application/pdf"
  }).promise();


  return {
    statusCode: 201,
    body: JSON.stringify({
      message: "Certificate created!",
      url: `https://slscertificatesignite.s3.sa-east-1.amazonaws.com/${id}.pdf`
    }),
    headers: {
      "Content-type": "application/json"
    }
  };
};