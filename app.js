"use strict";
require("dotenv").config();

const request = require("request"),
  axios = require("axios"),
  cheerio = require("cheerio"),
  search_urls = require("./item-urls"),
  useless_items = require("./useless-items");

var twilio = require("twilio");
const open = require("open");

var twillioSID = ""; // Your Account SID from www.twilio.com/console
var twillioToken = ""; // Your Auth Token from www.twilio.com/console
const twillioFrom = "+"; // Twillio from
const twillioTo = ""; // Number to send to

var twilio = require("twilio");

var client = undefined;

if (twillioSID !== "" && twillioToken !== "") {
  client = new twilio(twillioSID, twillioToken);
}

var { getRequestDataFromJS } = require("./helper");

let as = [];
let isr = [];
async function handleAllURLs() {
  for (let item in search_urls) {
    let data = await getDataFromURL(item);

    // Loop through each item on page
    data.forEach((singleItem) => {
      var avail = decodeURI("\u2705");

      // Check if data returned is empty
      if (Object.keys(singleItem).length == 0) {
        return;
      }
      // Out of stock
      if (
        singleItem["in_stock"].indexOf("Notify Me") >= 0 ||
        singleItem["in_stock"].indexOf("Out of Stock") >= 0 ||
        singleItem["in_stock"].indexOf("OUT OF STOCK") >= 0
      ) {
        console.error(singleItem["name"] + " Out of stock");
        // Cross emoji
        avail = decodeURI("\u274C");
      }
      // In stock
      else {
        if (
          as[singleItem["name"]] == undefined
        ) {
          console.log(singleItem["name"] + " in stock");
          console.log(search_urls[item].link);
          if (client !== undefined){
            client.messages
              .create({
                body: singleItem["name"] + " in stock",
                from: twillioFrom,
                to: twillioTo,
              })
              .then((message) => console.log(message.sid));
          }
          as[singleItem["name"]] = 1;

          if (!isr.includes(search_urls[item].link)) {
            isr.push(search_urls[item].link);
          }
          console.log(isr);
        }
      }
    });
  }
  return true;
}

// Parses HTML from URL and returns data structure containing relevent data
async function getDataFromURL(item) {
  var item_url_dict = search_urls[item];
  var item_link = item_url_dict["link"];
  try {
    let response = await axios.get(item_link);
    let redirect_count = response.request._redirectable._redirectCount;
    var item_type = item_url_dict["type"];

    let $ = cheerio.load(response.data);
    var items = [];

    // Multiple items in a page
    if (item_type === "multi") {
      $(".grouped-item").each(function (index, element) {
        let item_name = $(element).find(".item-name").text();
        items[index] = {};
        // Check for useless items
        if (useless_items.indexOf(item_name) >= 0) {
          return;
        }
        items[index]["name"] = $(element).find(".item-name").text();
        items[index]["price"] = $(element).find(".price").text();
        items[index]["in_stock"] = $(element)
          .find(".bin-stock-availability")
          .text();
      });
    } else if (item_type === "bone") {
      // Boneyard page exists
      if (redirect_count == 0) {
        $(".grouped-item").each(function (index, element) {
          items[index] = {};
          items[index]["name"] = $(element).find(".item-name").text();
          items[index]["price"] = $(element).find(".price").text();
          items[index]["in_stock"] = $(element)
            .find(".bin-stock-availability")
            .text();
        });
      } else {
        items[0] = {};
        items[0]["in_stock"] = "Notify Me";
      }
    } else if (item_type === "grab bag") {
      // Boneyard page exists
      if (redirect_count == 0) {
        items = getRequestDataFromJS(response.data, "RogueColorSwatches");
      } else {
        items[0] = {};
        items[0]["in_stock"] = "Notify Me";
      }
    } else if (item_type === "cerakote") {
      items = getRequestDataFromJS(response.data, "relatedColorSwatches");
    } else if (item_type === "monster bench") {
      var obj = $("script[type='text/javascript']");
      let info = [];
      loop1: for (var i in obj) {
        for (var j in obj[i].children) {
          var data = obj[i].children[j].data;
          if (data && data.includes("RogueColorSwatches")) {
            data = data.substring(
              data.indexOf("RogueColorSwatches"),
              data.length
            );
            var split_data = data.split(/[[\]]{1,2}/);
            split_data.forEach((item) => {
              if (item.includes("additional_options")) {
                var stripped_str = item.substring(
                  item.indexOf("{"),
                  item.lastIndexOf("realLabel") - 2
                );
                info.push(JSON.parse(stripped_str));
              }
            });
            break loop1;
          }
        }
      }
      info = info.slice(0, 2);
      info.forEach((element, index) => {
        Object.keys(element).forEach((mini_item, index2) => {
          items[index * 3 + index2] = {};
          items[index * 3 + index2]["name"] =
            element[mini_item]["product_name"];
          items[index * 3 + index2]["in_stock"] = element[mini_item][
            "isInStock"
          ]
            ? "Add to Cart"
            : "Notify Me";
          items[index * 3 + index2]["price"] = $(".price").first().text();
        });
      });
    } else if (item_type === "rmlc") {
      var obj = $("script[type='text/javascript']");
      let info = [];
      loop1: for (var i in obj) {
        for (var j in obj[i].children) {
          var data = obj[i].children[j].data;
          if (data && data.includes("RogueColorSwatches")) {
            data = data.substring(
              data.indexOf("RogueColorSwatches"),
              data.length
            );
            var split_data = data.split(/[[\]]{1,2}/);
            split_data.forEach((item) => {
              if (item.includes("additional_options")) {
                var stripped_str = item.substring(
                  item.indexOf("{"),
                  item.lastIndexOf("realLabel") - 2
                );
                info.push(JSON.parse(stripped_str));
              }
            });
          }
        }
      }
      info = info.slice(0, 11);
      info.forEach((element, index) => {
        Object.keys(element).forEach((mini_item, index2) => {
          let label = element[mini_item]["label"];
          let name_label = label.substring(0, label.indexOf("("));
          let dic = {
            name:
              index2 == 0 ? name_label + "Standard" : name_label + "Numbered",
            in_stock: element[mini_item]["isInStock"]
              ? "Add to Cart"
              : "Notify Me",
            price: $(".price").first().text(),
          };
          items.push(dic);
        });
      });
    } else if (item_type === "trolley") {
      items = getRequestDataFromJS(response.data, "RogueColorSwatches", 4);
    } else if (item_type === "db15") {
      items = getRequestDataFromJS(response.data, "RogueColorSwatches", 2);
    } else if (item_type === "custom2") {
      items = getRequestDataFromJS(response.data, "RogueColorSwatches");
    } else if (item_type === "custom") {
      items = getRequestDataFromJS(response.data, "ColorSwatches");
    } else if (item_type === "ironmaster") {
      items[0] = {};
      items[0]["name"] = $(".product_title").text();
      items[0]["price"] = "N/A";
      items[0]["in_stock"] = $("span.stock").text();
    }
    // Just one item in a page
    else {
      items[0] = {};
      items[0]["name"] = $(".product-title").text();
      items[0]["price"] = $(".price").text();
      items[0]["in_stock"] = $(".product-options-bottom button").text();
    }
    return items;
  } catch (error) {
    console.log(`Error: ${error}`);
  }
}

function getTimeDiff(start_time) {
  var curr_time = new Date();
  var time_elapsed = (curr_time - start_time) / 1000;

  var seconds = Math.round(time_elapsed % 60);
  // remove seconds from the date
  time_elapsed = Math.floor(time_elapsed / 60);

  // get minutes
  var minutes = Math.round(time_elapsed % 60);

  // remove minutes from the date
  time_elapsed = Math.floor(time_elapsed / 60);

  // get hours
  var hours = Math.round(time_elapsed % 24);

  // remove hours from the date
  time_elapsed = Math.floor(time_elapsed / 24);
  var time_elapsed_str = `${time_elapsed} days ${hours}:${minutes}:${seconds}`;
  return time_elapsed_str;
}

var stdin = process.stdin;

stdin.setRawMode(true);
stdin.resume();
stdin.setEncoding("utf8");

stdin.on("data", function (key) {
  // ctrl-c ( end of text )
  if (key === "\u0003") {
    process.exit();
  }

  for (let url of isr) {
    open(url);
  }
});

let interval = 0;
console.log("Starting");

setInterval(() => {
  handleAllURLs();
  interval += 1;
  if (interval % 10 == 0) {
    console.clear();
    console.log("In business");

    as = [];
    isr = [];
    interval = 0;
  }
}, 10000);
