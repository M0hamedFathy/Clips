import { Injectable } from "@angular/core";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import { blob } from "stream/consumers";

@Injectable({
  providedIn: "root",
})
export class FfmpegService {
  isRunning = false;
  isReady = false;
  private ffmpeg;

  constructor() {
    this.ffmpeg = createFFmpeg({ log: true });
  }

  async init() {
    if (this.isReady) {
      return;
    }

    await this.ffmpeg.load();

    this.isReady = true;
  }
  async getScreenshots(file: File) {
    this.isRunning = true;
    //this is responsible for converting the data to binary
    const data = await fetchFile(file);

    //This is responsible for storing the data
    this.ffmpeg.FS("writeFile", file.name, data);

    const seconds = [1, 2, 3];
    const commands: string[] = [];

    seconds.forEach((second) => {
      commands.push(
        //Input we telling the ffmpeg which file we want to process
        "-i",
        file.name,

        // Output option
        "-ss",
        // which sec would you like to capture the screenshot "hh:mm:ss"
        `00:00:0${second}`,
        //how many frames would you like to capture we letting the ffmpeg decide it according the the vid
        "-frames:v",
        "1",
        //creating an image and applying a filter on it so we can reduce it's size
        "-filter:v",
        //creating the scale for the screen shot we can force hight and width by using this fn however if we use -1 it will check the original aspect
        "scale=510:-1",

        //Output
        `output_0${second}.png`
      );
    });

    await this.ffmpeg.run(...commands);

    const screenshots: string[] = [];

    //converting data from binary to image
    seconds.forEach((second) => {
      const screenshotFile = this.ffmpeg.FS(
        "readFile",
        `output_0${second}.png`
      );

      const screenshotBlob = new Blob([screenshotFile.buffer], {
        type: "image/png",
      });

      const screenshotURL = URL.createObjectURL(screenshotBlob);

      screenshots.push(screenshotURL);
    });

    this.isRunning = false;

    return screenshots;
  }

  async blobFromURL(url: string) {
    const response = await fetch(url);
    const blob = await response.blob();

    return blob;
  }
}
