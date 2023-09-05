const puppeteer = require("puppeteer");
const express = require("express");
const cors = require("cors");
const https = require("https");
const fs = require("fs-extra");

const app = express();
const port = process.env.PORT || 8300;
app.use(express.json({ limit: "50mb" }));
app.use(cors());

var options = {
    key: fs.readFileSync('/etc/letsencrypt/live/zt-gantt.zehntech.net/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/zt-gantt.zehntech.net/fullchain.pem')
}
const httpsServer = https.createServer(options, app);

app.post("", (req, res) => {
  (async function () {
    try {
      const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
      });

      let concatenatedString = "";
      for (let i = 0; i < req.body?.styles?.length; i++) {
        concatenatedString +=
          `<link rel="stylesheet" href="${req.body.styles[i]}" />\n`;
      }
      const page = await browser.newPage();
      const htmlContent = `<!DOCTYPE html>
     <html lang="en">
       <head>
         <meta charset="UTF-8" />
       <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>ZT Gantt</title>
        `;
      let content =
        htmlContent +
        concatenatedString +
        "</head>\n<body>" +
        `${req.body.content}` +
        "</body>\n</html>";
      await page.setContent(content, {
        waitUntil: ["domcontentloaded", "networkidle0"],
      });

      if (req.headers.origin.match("https://zehntech.github.io")) {
        // Add watermark using CSS
        await page.evaluate(() => {
          const watermark = document.createElement("h1");
          watermark.textContent = "DEMO";
          watermark.style.position = "fixed";
          watermark.style.top = "40%";
          watermark.style.left = "40%";
          watermark.style.transform = "translate(-50%, -50%)";
          watermark.style.fontSize = "148px";
          watermark.style.color = "#aaaaaa47";
          watermark.style.zIndex = "99999";
          watermark.style.transform = "rotate(-45deg)";
          watermark.style.transformOrigin = "center";
          document.body.appendChild(watermark);
        });
      }

      // Add footer using CSS
      await page.evaluate(() => {
        const footer = document.createElement("p");
        footer.textContent =
          "This document is created with zt-gantt library: https://github.com/zehntech/zt-gantt";
        footer.style.position = "fixed";
        footer.style.bottom = "20px";
        footer.style.left = "20px";
        footer.style.fontSize = "16px";
        footer.style.color = "#aaaaaa";
        document.body.appendChild(footer);
      });

      if (req.body.fileType === "png") {
        const contentMetrics = await page.evaluate(() => {
          const sidebar = document.querySelector("#zt-gantt-grid-left-data");
          const timeLine = document.querySelector("#zt-gantt-right-cell");

          let isVerScroll = document.querySelector("#zt-gantt-ver-scroll-cell");
          let verScrollWidth = isVerScroll ? isVerScroll.offsetWidth : 0;

          const body = document.body;
          body.firstChild.style.width = "auto";
          body.firstChild.style.height = "auto";

          return {
            totalwid: sidebar.scrollWidth + timeLine.scrollWidth,
            totalheight: sidebar.scrollHeight + 100,
            verScrollWidth: verScrollWidth,
          };
        });

        await page.setViewport({
          width: contentMetrics.totalwid + contentMetrics.verScrollWidth,
          height: contentMetrics.totalheight + 100,
        });
        response = await page.screenshot({ fullPage: true });
      }

      if (req.body.fileType === "pdf") {
        const contentMetrics = await page.evaluate(() => {
          const sidebar = document.querySelector("#zt-gantt-grid-left-data");
          const timeLine = document.querySelector("#zt-gantt-right-cell");

          const body = document.body;

          let isVerScroll = document.querySelector("#zt-gantt-ver-scroll-cell");
          let isHorScroll = document.querySelector("#zt-gantt-hor-scroll-cell");
          if(isVerScroll){
            isVerScroll.classList.add("d-none");
          }
          if(isHorScroll){
            isHorScroll.classList.add("d-none");
          }
          let verScrollWidth = isVerScroll ? isVerScroll.offsetWidth : 0;

          body.firstChild.style.width = "auto";
          body.firstChild.style.height = "auto";
          body.overflow = 'hidden';
          body.margin = "0";
          body.padding = "0";

          return {
            timeLine: timeLine.scrollHeight,
            wid: sidebar.clientWidth + timeLine.clientWidth,
            totalwid: sidebar.offsetWidth + timeLine.scrollWidth,
            totalheight: sidebar.scrollHeight,
            verScrollWidth: verScrollWidth,
          };
        });
        if (contentMetrics.totalwid > 1924) {
          response = await page.pdf({
            height: contentMetrics.totalheight + 100,
            width:
              contentMetrics.totalwid +
              contentMetrics.verScrollWidth -
              contentMetrics.totalwid * 0.33,
            printBackground: true,
          });
        } else {
          let totalWidth =  contentMetrics.totalwid +
          contentMetrics.verScrollWidth
          response = await page.pdf({
            height: contentMetrics.totalheight + 100,
            width: totalWidth - (totalWidth * 0.32),
            margin: {
              right: "10",
              left: "10",
            },
            printBackground: true,
          });
        }
      }

      res.send(
        response ? { message: "success", data: response } : { message: "error" }
      );
      await browser.close();
    } catch (e) {
      console.log("Internal server error", e);
      res.status(500).json({ error: 'Internal server error' });
    }
  })();
});

httpsServer.listen(port);

// app.listen(port,"192.168.0.102", () => {
//   console.log(`connection setup at port no. ${port} `);
// });
