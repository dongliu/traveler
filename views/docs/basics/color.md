### Colors and graphical design

The Web presentation layer of the traveler application is developed on
[Bootstrap](http://getbootstrap.com/). Therefore, the application uses a similar
color convention as Bootstrap in the interface design. The buttons are colored
according to the possible impact of the actions.

<div><button class="btn btn-primary">primary</button></div>
<div><button class="btn btn-info">information</button></div>
<div><button class="btn btn-success">success</button></div>
<div><button class="btn btn-waring">waring</button></div>
<div><button class="btn btn-danger">danger</button></div>

Each traveler or binder has an estimated progress. The progress is visualized by
a bar. The bar color and corresponding entity status is listed in the following
table.

| progress bar                                                                                                                                                                                                              | status                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| <div class="progress" style="width: 100px;"><div class="bar bar-success" style="width:0%;"></div><div class="bar bar-info" style="width:0%;"></div><div class="progress-value">0 / 7</div></div>                          | initial                            |
| <div class="progress active progress-striped" style="width: 100px;"><div class="bar bar-success" style="width:0%;"></div><div class="bar bar-info" style="width:28%;"></div><div class="progress-value">2 / 7</div></div> | active                             |
| <div class="progress" style="width: 100px;"><div class="bar bar-success" style="width:100%;"></div><div class="bar bar-info" style="width:0%;"></div><div class="progress-value"></div></div>                             | completion                         |
| <div class="progress" style="width: 100px;"><div class="bar bar-success" style="width:0%;"></div><div class="bar bar-info" style="width:85%;"></div><div class="progress-value">6 / 7</div></div>                         | submitted for completion or frozen |

<br/>

Some progress bars have values on it. The formats of the value notations are
listed in the following table.

| entity type                  | progress bar                                                                                                                                                                                                                   | values                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| traveler                     | <div class="progress active progress-striped" style="width: 100px;"><div class="bar bar-success" style="width:0%;"></div><div class="bar bar-info" style="width:28%;"></div><div class="progress-value">2 / 7</div></div>      | updated input number / total input number        |
| binder or entity in a binder | <div class="progress active progress-striped" style="width: 100px;"><div class="bar bar-success" style="width:0%;"></div><div class="bar bar-info" style="width:25%;"></div><div class="progress-value">0 + 3 / 10</div></div> | finished value + in-progress value / total value |
