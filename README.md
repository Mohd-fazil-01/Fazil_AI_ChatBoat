# Fazil Resume Assistant

A full-stack ChatGPT-style web application for recruiters and HR professionals to interact with an AI representing Mohd Fazil. You can ask questions about his resume and even upload a Job Description (`.pdf` or `.docx`) to get an honest fit analysis.

## Features
- **Real-time Streaming:** Uses Server-Sent Events (SSE) to stream responses token-by-token from the Groq API (Llama 3.3).
- **Job Description Analysis:** Upload a PDF or DOCX file, and the AI will analyze the JD against Fazil's skills and experience.
- **Persistent Chat:** Chat history is saved locally so it survives server restarts.
- **Custom UI:** A beautiful, responsive ChatGPT-style interface built with React and Vanilla CSS.

## Setup Instructions

### Prerequisites
- Node.js (v16+)

### 1. Backend (`/server`)

1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
4. Edit the `.env` file and add your `GROQ_API_KEY`.

5. Start the backend server:
   ```bash
   npm run dev
   ```
   The server will run on `http://localhost:5000`.

### 2. Frontend (`/client`)

1. Navigate to the client directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   The application will typically open on `http://localhost:5173`.

## Architecture Details

- **Frontend:** React (Vite) + Plain CSS. `react-markdown` handles the markdown rendering of the assistant's responses.
- **Backend:** Node.js + Express. Uses `multer` for file uploads, `pdf-parse` & `mammoth` for document text extraction, and the `groq-sdk` for LLM interaction.
- **Streaming:** The `/api/chat` endpoint is state-less per request. The frontend sends the entire history, and the backend streams back the response using `text/event-stream`.
