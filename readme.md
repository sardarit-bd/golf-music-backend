# 🎵 Golf-Music Backend

### 📖 Overview  
This repository powers the backend for the **Golf Music** platform — a complete **music-artist dashboard and subscriber management system**.  
Built with **Node.js**, **Express**, and **MongoDB**, it provides APIs for **artist profiles**, **songs**, **venues**, **news**, and **user authentication**.

It supports user roles such as **Admin**, **Artist**, **Journalist**, and **Venue**, each with tailored features:

- 🎤 Artist uploads (MP3, photos)
- 🏛️ Venue profile management
- 📰 Journalist news publishing
- 👥 Subscriber handling and JWT-based authentication
- 📧 Email notifications via SMTP (Nodemailer)
- 🔒 Environment-based configuration for secure deployment

---

### 🧱 Tech Stack  
- **Node.js** — Server runtime  
- **Express.js** — Web framework  
- **MongoDB + Mongoose** — Database and ORM  
- **JWT** — Authentication & authorization  
- **dotenv** — Environment variable management  
- **Nodemailer** — Email service integration  

---

### ⚙️ Environment Variables  
Create a file named `.env.development` in the **project root directory** and add the following:

```bash
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/golfmusic
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=7d
EMAIL_SERVICE=gmail
EMAIL_USERNAME=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
CLIENT_URL=http://localhost:3000

```














### Clone the repository and move the folder

```bash
git clone https://github.com/sardarit-bd/golf-music-backend.git
cd golf-music-backend
```




### Install dependencies and start the server

```bash
npm install

# Start the server in development mode (using nodemon)
npm run dev

# Or start normally
npm start

```






### You will see"
Environment Variables Loaded:
MONGODB_URI: mongodb://localhost:27017/golfmusic



### And you can access 
http://localhost:5000




#  Thank you so Much
