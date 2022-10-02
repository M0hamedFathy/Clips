import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  ViewEncapsulation,
} from "@angular/core";
import { ActivatedRoute, Params } from "@angular/router";
import videojs from "video.js";
import IClip from "../models/clip.model";
import { DatePipe } from "@angular/common";

@Component({
  selector: "app-clip",
  templateUrl: "./clip.component.html",
  styleUrls: ["./clip.component.css"],
  // we using this to disable the encapsulation
  encapsulation: ViewEncapsulation.None,
  providers: [DatePipe],
})
export class ClipComponent implements OnInit {
  // we have added the static method because we want the element to be ready before we initialize the component with the ngOnInit
  @ViewChild("videoPlayer", { static: true }) target?: ElementRef;
  player?: videojs.Player;
  clip?: IClip;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // we accessing the element by direct access not an instance by using native element
    this.player = videojs(this.target?.nativeElement);

    this.route.data.subscribe((data) => {
      this.clip = data.clip as IClip;

      this.player?.src({
        src: this.clip?.url,
        type: "video/mp4",
      });
    });
  }
}
