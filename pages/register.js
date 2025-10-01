import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/router";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleRegister = async (e) => {
    e.preventDefault();
    await axios.post("/api/auth/register", { email, password });
    router.push("/login");
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Register</h2>
      <form onSubmit={handleRegister}>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button type="submit">Register</button>
      </form>
    </div>
  );
}
