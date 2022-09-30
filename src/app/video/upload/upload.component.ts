import { Component, OnDestroy } from "@angular/core";
import { AngularFireAuth } from "@angular/fire/compat/auth";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import {
  AngularFireStorage,
  AngularFireUploadTask,
} from "@angular/fire/compat/storage";
import { v4 as uuid } from "uuid";
import { last, switchMap } from "rxjs/operators";
import firebase from "firebase/compat/app";
import { ClipService } from "src/app/services/clip.service";
import { Router } from "@angular/router";

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

  title = new FormControl("", [Validators.required, Validators.minLength(3)]);
  uploadForm = new FormGroup({
    title: this.title,
  });

  constructor(
    private storage: AngularFireStorage,
    private auth: AngularFireAuth,
    private clipsService: ClipService,
    private router: Router
  ) {
    auth.user.subscribe((user) => (this.user = user));
  }

  ngOnDestroy(): void {
    this.task?.cancel();
  }

  storeFile($event: Event) {
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

    this.title.setValue(this.file.name.replace(/\.[^/.]+$/, ""));
    this.nextStep = true;
  }

  uploadFile() {
    // to disable the form from being edit while the vid is being uploaded
    this.uploadForm.disable();

    this.showAlert = true;
    this.alertColor = "blue";
    this.alertMsg = "Please wait! Your clip is being uploaded";
    this.inSubmission = true;
    this.showPercentage = true;

    const clipFileName = uuid();
    const clipPath = `clips/${clipFileName}.mp4`;
    this.task = this.storage.upload(clipPath, this.file);
    const clipRef = this.storage.ref(clipPath);

    // Getting the percentage of the upload
    this.task.percentageChanges().subscribe((progress) => {
      this.percentage = (progress as number) / 100;
    });

    // Showing the status msg
    this.task
      .snapshotChanges()
      .pipe(
        last(),
        switchMap(() => clipRef.getDownloadURL())
      )
      .subscribe({
        next: async (url) => {
          const clip = {
            uid: this.user?.uid as string,
            displayName: this.user?.displayName as string,
            title: this.title.value as string,
            fileName: `${clipFileName}.mp4`,
            url,
            timeStamp: firebase.firestore.FieldValue.serverTimestamp(),
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
