import { Component } from '@angular/core';
import { ShareService } from 'src/app/share.service';
import { ThemeService } from 'src/app/theme.service';


@Component({
  selector: 'app-nav-bar',
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.scss']
})

export class NavBarComponent {

  signalSolve: boolean = true;
  signalPlay: boolean = false;
  quote_author: string = "";
  quote_text: string = "";

  getRandomInt(max: number): number {
    return Math.floor(Math.random() * max);
  }

  constructor(private shareService: ShareService, public theme: ThemeService) {
    //Fetch API from JSON Quotes API
    // fetch("https://type.fit/api/quotes")
    // .then(function(response) {
    //   return response.json();
    // })
    // .then((data) => {
    //   this.quote_author = data[this.getRandomInt(data.length-1)].author;
    //   this.quote_text = data[this.getRandomInt(data.length-1)].text;
    // });
  }

  ngOnInit() {
    console.clear();
  }

  toggleTheme() {
    this.theme.toggle();
  }

  sendTingleSolve() {
    this.shareService.changeSolveSignal(true);
    this.shareService.changePlaySignal(false);
  }

  sendTinglePlay() {
    this.shareService.changeSolveSignal(false);
    this.shareService.changePlaySignal(true);
  }

  sendTingleAbout() {
    this.shareService.changeSolveSignal(false);
    this.shareService.changePlaySignal(false);

    this.shareService.playSignal.subscribe(signal => {
      this.signalPlay = signal;
      // if (this.signalPlay) {
      //   let playButton = document.getElementById("play");
      //   let solveButton = document.getElementById("solve");

      //   console.log(playButton);
      //   if (playButton != null) {
      //     playButton.style.borderBottom = '5px solid lime';
      //   }
      //   console.log(solveButton);
      //   if (solveButton != null) {
      //     solveButton.style.borderBottom = 'none';
      //   }
      // }
    });
    this.shareService.solveSignal.subscribe(signal => {
      this.signalSolve = signal;
    })
    if (this.signalPlay == false && this.signalSolve == false) {
      let playButton = document.getElementById("play");
      let solveButton = document.getElementById("solve");
      let aboutButton = document.getElementById("about");

      console.log(playButton);
      console.log(solveButton);
      console.log(aboutButton);
        if (playButton != null && solveButton != null) {
          playButton.style.borderBottom = 'none';
          solveButton.style.borderBottom = 'none';
        }

        if (aboutButton != null) {
          aboutButton.style.borderBottom = '5px solid lime';
        }

    }
  }
}
