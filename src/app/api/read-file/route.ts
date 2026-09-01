import { NextResponse } from 'next/server';
const pdfParse = require('pdf-parse');

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as Blob | File;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const type = file.type;
    const name = (file as File).name || "document.txt";
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let text = "";

    if (type === "application/pdf" || name.endsWith(".pdf")) {
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (
      type.startsWith("text/") || 
      type === "application/json" ||
      name.endsWith(".md") ||
      name.endsWith(".csv") ||
      name.endsWith(".txt")
    ) {
      text = buffer.toString("utf-8");
    } else {
      return NextResponse.json({ error: "Unsupported file type. Only PDF and Text files can be extracted." }, { status: 400 });
    }

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error("File reading error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
