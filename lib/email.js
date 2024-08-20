const nodemailer = require("nodemailer");

const transport = nodemailer.createTransport({
    host: "acnlinka.pbn.bnl.gov",
    port: 25,
    secure: false, // upgrade later with STARTTLS
  });