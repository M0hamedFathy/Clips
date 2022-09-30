import { switchMap, map } from "rxjs/operators";
import { AngularFireAuth } from "@angular/fire/compat/auth";
import { Injectable } from "@angular/core";
import {
  AngularFirestore,
  AngularFirestoreCollection,
  DocumentReference,
  QuerySnapshot,
} from "@angular/fire/compat/firestore";
import IClip from "../models/clip.model";
import { of, BehaviorSubject, combineLatest } from "rxjs";
import { AngularFireStorage } from "@angular/fire/compat/storage";

@Injectable({
  providedIn: "root",
})
export class ClipService {
  public clipsCollection: AngularFirestoreCollection<IClip>;

  constructor(
    private db: AngularFirestore,
    private auth: AngularFireAuth,
    private storage: AngularFireStorage
  ) {
    this.clipsCollection = db.collection("clips");
  }

  createClip(data: IClip): Promise<DocumentReference<IClip>> {
    //by using add instead of set the fire base will create the id for you
    return this.clipsCollection.add(data);
  }

  // getting the vids with the user id
  getUserClips(sort$: BehaviorSubject<string>) {
    // in order for you to use combineLatest you need to pass the observable in an array
    return combineLatest([this.auth.user, sort$]).pipe(
      switchMap((values) => {
        const [user, sort] = values;
        if (!user) {
          return of([]);
        }

        const query = this.clipsCollection.ref
          .where("uid", "==", user.uid)
          //ordering the videos with the time stamp
          .orderBy("timestamp", sort === "1" ? "desc" : "asc");

        return query.get();
      }),
      map((snapshot) => (snapshot as QuerySnapshot<IClip>).docs)
    );
  }

  updateClip(id: string, title: string) {
    //Updating the clip title from the manage page
    return this.clipsCollection.doc(id).update({
      title,
    });
  }
  async deleteClip(clip: IClip) {
    // Deleting the vid
    const clipRef = this.storage.ref(`clips/${clip.fileName}`);

    await clipRef.delete();

    //Deleting the collection data that we do have
    await this.clipsCollection.doc(clip.docID).delete();
  }
}
