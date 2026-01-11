// Simple auth for demo (edit here)
const AUTH = {
  user: "admin",
  pass: "1234",
  key: "youbube_auth"
};

function isAuthed(){
  return localStorage.getItem(AUTH.key) === "1";
}

function logout(){
  localStorage.removeItem(AUTH.key);
  window.location.href = "index.html";
}

// If on login page
document.addEventListener("DOMContentLoaded", () => {
  const isLoginPage = !!document.getElementById("loginForm");
  const isAppPage = !!document.getElementById("nav");

  if (isAppPage && !isAuthed()){
    window.location.href = "index.html";
    return;
  }

  if (isLoginPage){
    if (isAuthed()){
      window.location.href = "app.html";
      return;
    }

    const form = document.getElementById("loginForm");
    const msg = document.getElementById("loginMsg");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      form.classList.add("was-validated");
      const u = document.getElementById("username").value.trim();
      const p = document.getElementById("password").value.trim();

      if (!u || !p) return;

      if (u === AUTH.user && p === AUTH.pass){
        localStorage.setItem(AUTH.key, "1");
        window.location.href = "app.html";
      } else {
        msg.style.display = "block";
        msg.textContent = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
      }
    });
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn){
    logoutBtn.addEventListener("click", logout);
  }
});
