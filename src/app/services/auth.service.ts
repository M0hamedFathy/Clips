import { Injectable } from "@angular/core";
import { AngularFireAuth } from "@angular/fire/compat/auth";
import {
  AngularFirestore,
  AngularFirestoreCollection,
} from "@angular/fire/compat/firestore";
import { Observable, of } from "rxjs";
import { map, delay, filter, switchMap } from "rxjs/operators";
import IUser from "../models/user.model";
import { Router } from "@angular/router";
import { ActivatedRoute, NavigationEnd } from "@angular/router";

@Injectable({
  providedIn: "root",
})
export class AuthService {
  private userCollection: AngularFirestoreCollection<IUser>;
  public isAuthenticated$: Observable<boolean>;
  public isAuthenticatedWithDelay$: Observable<boolean>;
  private redirect = false; // this variable to make sure if the page that we currently browsing doesn't need login AUTH so you wouldn't be redirected from it

  constructor(
    private auth: AngularFireAuth,
    private db: AngularFirestore,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.userCollection = db.collection("users");
    this.isAuthenticated$ = auth.user.pipe(map((user) => !!user));

    this.isAuthenticatedWithDelay$ = this.isAuthenticated$.pipe(delay(1000));
    // we using this approach because we can't access the data emitted from the route directly  so we accessing the events
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        map((e) => this.route.firstChild),
        // ?? is s new feature at JS which will make sure that the returned value is not null (the value on the left side of the operator) and the value on the right side is the value if we can't retrieve the data
        switchMap((route) => route?.data ?? of({}))
      )
      .subscribe((data) => {
        this.redirect = data.authOnly ?? false;
      });
  }

  public async createUser(userData: IUser) {
    if (!userData.password) {
      throw new Error("Password not provided");
    }
    const userCred = await this.auth.createUserWithEmailAndPassword(
      userData.email as string,
      userData.password as string
    );

    if (!userCred.user) {
      throw new Error("user can't be found");
    }

    await this.userCollection.doc(userCred.user.uid).set({
      name: userData.name,
      email: userData.email,
      age: userData.age,
      phoneNumber: userData.phoneNumber,
    });

    await userCred.user.updateProfile({
      displayName: userData.name,
    });
  }
  public async logout($event?: Event) {
    if ($event) {
      $event.preventDefault();
    }

    await this.auth.signOut();

    if (this.redirect) {
      await this.router.navigateByUrl("/");
    }
  }
}
