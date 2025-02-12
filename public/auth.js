document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form")
    const messageDiv = document.getElementById("message")
  
    form.addEventListener("submit", async (e) => {
      e.preventDefault()
  
      const formData = new FormData(form)
      const data = Object.fromEntries(formData.entries())
  
      const endpoint = form.id === "registerForm" ? "/register" : "/login"
  
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        })
  
        const result = await response.json()
  
        if (response.ok) {
          messageDiv.textContent = result.message
          messageDiv.classList.remove("error")
          messageDiv.classList.add("success")
  
          if (endpoint === "/login") {
            localStorage.setItem("isLoggedIn", "true")
          }
  
          // Redirect to home page after successful login/registration
          setTimeout(() => {
            window.location.href = "index.html"
          }, 2000)
        } else {
          messageDiv.textContent = result.message
          messageDiv.classList.remove("success")
          messageDiv.classList.add("error")
        }
        messageDiv.classList.remove("hidden")
      } catch (error) {
        console.error("Error:", error)
        messageDiv.textContent = "An error occurred. Please try again."
        messageDiv.classList.remove("success")
        messageDiv.classList.add("error")
        messageDiv.classList.remove("hidden")
      }
    })
  })
  
  