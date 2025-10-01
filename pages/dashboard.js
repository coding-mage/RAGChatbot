import { useState } from "react";
import axios from "axios";

export default function Dashboard() {
  const [files, setFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");

  const handleUpload = async () => {
    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach((file) => formData.append("file", file));

    try {
      const res = await axios.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.queued) alert("Files queued for processing!");
    } catch (err) {
      console.error(err);
      alert("Upload failed: " + err.response?.data?.error || err.message);
    }
  };

  const handleSend = async () => {
    const { data } = await axios.post("/api/chat", { question: query });
    setMessages([...messages, { role: "user", text: query }, { role: "bot", text: data.answer }]);
    setQuery("");
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Left panel: Upload */}
      <div style={{ width: "40%", borderRight: "1px solid gray", padding: "1rem" }}>
        <h3>Upload PDF(s)</h3>
        <input
          type="file"
          accept="application/pdf"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files))}
        />
        <button onClick={handleUpload}>Upload</button>
      </div>

      {/* Right panel: Chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1rem" }}>
        <h3>Chat with your Docs</h3>
        <div style={{ flex: 1, overflowY: "auto", border: "1px solid #ddd", padding: "1rem" }}>
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: "0.5rem" }}>
              <b>{m.role}:</b> {m.text}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", marginTop: "1rem" }}>
          <input
            style={{ flex: 1, marginRight: "0.5rem" }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question..."
          />
          <button onClick={handleSend}>Send</button>
        </div>
      </div>
    </div>
  );
}
