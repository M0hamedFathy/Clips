import { Component, OnDestroy } from "@angular/core";
import { AngularFireAuth } from "@angular/fire/compat/auth";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import {
  AngularFireStorage,
  AngularFireUploadTask,
} from "@angular/fire/compat/storage";
import { v4 as uuid } from "uuid";
import { switchMap } from "rxjs/operators";
import firebase from "firebase/compat/app";
import { ClipService } from "src/app/services/clip.service";
import { Router } from "@angular/router";
import { FfmpegService } from "src/app/services/ffmpeg.service";
import { combineLatest, forkJoin } from "rxjs";

@Component({
  selector: "app-upload",
  templateUrl: "./upload.component.html",
  styleUrls: ["./upload.component.css"],
})
export class UploadComponent implements OnDestroy {
  isDragover = false;
  file: File | null = null;
  nextStep = false;
  showAlert = false;
  alertColor = "blue";
  alertMsg = "Please wait! Your clip is being uploaded";
  inSubmission = false;
  percentage = 0;
  showPercentage = false;
  user: firebase.User | null = null;
  task?: AngularFireUploadTask;
  screenshots: string[] = [];
  selectedScreenshot = "";
  screenshotTask?: AngularFireUploadTask;

  title = new FormControl("", [Validators.required, Validators.minLength(3)]);
  uploadForm = new FormGroup({
    title: this.title,
  });

  constructor(
    private storage: AngularFireStorage,
    private auth: AngularFireAuth,
    private clipsService: ClipService,
    private router: Router,
    public ffmpegService: FfmpegService
  ) {
    auth.user.subscribe((user) => (this.user = user));
    this.ffmpegService.init();
  }

  ngOnDestroy(): void {
    this.task?.cancel();
  }

  async storeFile($event: Event) {
    if (this.ffmpegService.isRunning) {
      return;
    }

    this.isDragover = false;

    //We using ?? in case we got undefined value to return null instead
    this.file = ($event as DragEvent).dataTransfer
      ? ($event as DragEvent).dataTransfer?.files.item(0) ?? null
      : // Checking if the file id being uploaded from the input field because it would be stored at diff place
        ($event.target as HTMLInputElement).files?.item(0) ?? null;

    //Mime type a label identify the type of data in a file broken into two parts. the type and the subtype separated by a slash /
    if (!this.file || this.file.type !== "video/mp4") {
      return;
    }

    //passing the data for the ffmpegService so it can handle it
    this.screenshots = await this.ffmpegService.getScreenshots(this.file);

    this.selectedScreenshot = this.screenshots[0];

    this.title.setValue(this.file.name.replace(/\.[^/.]+$/, ""));
    this.nextStep = true;
  }

  async uploadFile() {
    // to disable the form from being edit while the vid is being uploaded
    this.uploadForm.disable();

    this.showAlert = true;
    this.alertColor = "blue";
    this.alertMsg = "Please wait! Your clip is being uploaded";
    this.inSubmission = true;
    this.showPercentage = true;

    const clipFileName = uuid();
    const clipPath = `clips/${clipFileName}.mp4`;

    //Uploading screenshots to firebase
    const screenshotBlob = await this.ffmpegService.blobFromURL(
      this.selectedScreenshot
    );
    const screenshotPath = `screenshots/${clipFileName}.png`;

    //uploading videos first
    this.task = this.storage.upload(clipPath, this.file);
    const clipRef = this.storage.ref(clipPath);

    //uploading screenshots 2nd
    this.screenshotTask = this.storage.upload(screenshotPath, screenshotBlob);

    const screenshotRef = this.storage.ref(screenshotPath);

    // Getting the percentage of the upload
    combineLatest([
      this.task.percentageChanges(),
      this.screenshotTask.percentageChanges(),
    ]).subscribe((progress) => {
      const [clipProgress, screenshotProgress] = progress;

      if (!clipProgress || !screenshotProgress) {
        return;
      }
      const total = clipProgress + screenshotProgress;

      this.percentage = (total as number) / 200;
    });

    // Showing the status msg
    forkJoin([
      this.task.snapshotChanges(),
      this.screenshotTask.snapshotChanges(),
    ])
      .pipe(
        switchMap(() =>
          forkJoin([clipRef.getDownloadURL(), screenshotRef.getDownloadURL()])
        )
      )
      .subscribe({
        next: async (urls) => {
          const [clipURL, screenshotURL] = urls;

          const clip = {
            uid: this.user?.uid as string,
            displayName: this.user?.displayName as string,
            title: this.title.value as string,
            fileName: `${clipFileName}.mp4`,
            url: clipURL,
            screenshotURL,
            screenshotFileName: `${clipFileName}.png`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          };

          const clipDocRef = await this.clipsService.createClip(clip);

          this.alertColor = "green";
          this.alertMsg =
            "Success! Your clip is now ready to share with the world.";
          this.showPercentage = false;

          // redirecting the user to the clip route and we used the setTimeout so the user can see the msgs
          setTimeout(() => {
            this.router.navigate(["clip", clipDocRef.id]);
          }, 1000);
        },
        error: (error) => {
          //To enable the form incase there's an error so the user can interact with it again
          this.uploadForm.enable();

          this.alertColor = "red";
          this.alertMsg = "Upload failed! Please try again later.";
          this.inSubmission = true;
          this.showPercentage = false;
          console.error(error);
        },
      });
  }
}
