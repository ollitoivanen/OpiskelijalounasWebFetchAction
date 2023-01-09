//Åpiskelijalounas
import fetch from "node-fetch";
import core from "@actions/core";

import { Octokit } from "@octokit/core";

//Kårkafeerna restaurant data fetch and format functions

const karkaWebsite = "https://www.karkafeerna.fi/fi/lounas";

//Groups 1-6
const karkaPriceGroups = [
  "4,25 - 15,00€",
  "2,95€",
  "2,95€",
  "2,65€",
  "2,95€",
  "1,50€",
];

const karkaMealTypes = ["Vegaaninen", "Kasvis", "Lounas"];

const _fetchKarkaRestaurants = async () => {
  try {
    const response = await fetch("https://www.karkafeerna.fi/fi/lounas");
    if (!response.ok) return [];
    if (response.text === undefined) return [];
    const html = await response.text();
    const stringifiedHtml = html.toString();

    const restaurantsOnlyHtml = await _sliceHtmlToRestaurantsOnly(
      stringifiedHtml
    );

    if (restaurantsOnlyHtml === undefined) return [];
    let restaurantsArray = await _splitRestaurantsIntoArray(
      restaurantsOnlyHtml
    );

    let openRestaurantsArray = await _checkIfKarkaRestaurantOpen(
      restaurantsArray
    );

    if (openRestaurantsArray === undefined) return [];
    const readyRestaurantsArray =
      _createKarkaRestaurantsArray(openRestaurantsArray);
      console.log(readyRestaurantsArray)
    return readyRestaurantsArray;
  } catch (e) {
    console.log(e);
    return [];
  }
};

const _sliceHtmlToRestaurantsOnly = (html) => {
  const indexOfStartOfLunchList = html.indexOf('<div class="row lunch-item');

  //this is the class that follows last lucnh list
  const indexOfEndOfLunchList = html.lastIndexOf('<div class="row text-center');
  if ((indexOfStartOfLunchList || indexOfEndOfLunchList) === -1) return;
  const restaurantsOnlyHtml = html.slice(
    indexOfStartOfLunchList,
    indexOfEndOfLunchList
  );
  return restaurantsOnlyHtml;
};

const _splitRestaurantsIntoArray = (restaurants) => {
  const restaurantsArray = restaurants.split('<div class="row lunch-item ">');
  //Remove the first empty element
  restaurantsArray.shift();
  return restaurantsArray;
};

const _checkIfKarkaRestaurantOpen = async (restaurantsArray) => {
  let openRestaurantsArray = [];
  for (const restaurant of restaurantsArray) {
    //If restaurant is closed, "suljettu toistaiseksi" is displayed on the place
    //of open hours
    if (_getKarkaRestaurantOpenHours(restaurant) !== undefined) {
      openRestaurantsArray.push(restaurant);
    }
  }
  return openRestaurantsArray;
};

const _createKarkaRestaurantsArray = (rawRestaurantsArray) => {
  let readyRestaurantsArray = [];
  for (const restaurant of rawRestaurantsArray) {
    if (restaurant === undefined) return;
    const readyRestaurant = _createKarkaRestaurantObject(restaurant);
    if (readyRestaurant !== undefined)
      readyRestaurantsArray.push(readyRestaurant);
  }
  return readyRestaurantsArray;
};

const _createKarkaRestaurantObject = (karkaRestaurant) => {
  const name = _getKarkaRestaurantName(karkaRestaurant) || "";
  const url = karkaWebsite;
  let openHours = "Ei lounasta tänään";
  let menu = [];

  let lunchServed = _checkIfKarkaLunchServed(karkaRestaurant);
  if (lunchServed) {
    openHours = _getKarkaRestaurantOpenHours(karkaRestaurant);
    menu = _createKarkaRestaurantMenu(karkaRestaurant);
  }

  const restaurantObject = { name, url, openHours, menu };
  return restaurantObject;
};

const _getKarkaRestaurantName = (karkaRestaurant) => {
  const indexOfStartOfRestaurantName = karkaRestaurant.indexOf('alt="') + 5; //for 'alt="'
  const indexOfEndOfRestaurantName = karkaRestaurant.indexOf(
    '"',
    //Starts searching from the start of alts
    indexOfStartOfRestaurantName
  );

  if ((indexOfStartOfRestaurantName || indexOfEndOfRestaurantName) === -1)
    return;
  const restaurantName = karkaRestaurant.slice(
    indexOfStartOfRestaurantName,
    indexOfEndOfRestaurantName
  );
  return restaurantName;
};

const _checkIfKarkaLunchServed = (karkaRestaurant) => {
  const includesMenu = karkaRestaurant.includes('class="meal"');
  if (includesMenu) return true;
  return false;
};

const _getKarkaRestaurantOpenHours = (karkaRestaurant) => {
  const indexOfStartOfRestaurantOpenHours = karkaRestaurant.indexOf("<p>") + 3;
  const indexOfEndOfRestaurantOpenHours = karkaRestaurant.indexOf("</p>");
  

  if (
    indexOfStartOfRestaurantOpenHours === -1 ||
    indexOfEndOfRestaurantOpenHours === -1
  ) {
    return "Lounasaikaa ei annettu ";
  }

  let restaurantOpenHours = karkaRestaurant.slice(
    indexOfStartOfRestaurantOpenHours,
    indexOfEndOfRestaurantOpenHours
  );

  if (restaurantOpenHours == "suljettu toistaiseksi") {
    return;
  }

  const br = "<br/>";
  const includesBr = restaurantOpenHours.includes(br);

  if (includesBr) {
    restaurantOpenHours = restaurantOpenHours.split(br).join("\n");
  }

  return restaurantOpenHours;
};

const _createKarkaRestaurantMenu = (karkaRestaurant) => {
  const rawMealsArray = _splitKarkaRestaurantMenuToMealsArray(karkaRestaurant);
  if (rawMealsArray === undefined) return [];
  let readyMenu = [];
  for (const meal of rawMealsArray) {
    if (meal !== undefined) {
      let readyMeal = _createKarkaRestaurantMealObject(meal);
      if (readyMeal !== undefined) readyMenu.push(readyMeal);
    }
  }
  return readyMenu;
};

const _splitKarkaRestaurantMenuToMealsArray = (karkaRestaurant) => {
  //first index is redundant
  const mealsArray = karkaRestaurant.split('<div class="meal"').slice(1);
  return mealsArray;
};

const _createKarkaRestaurantMealObject = (meal) => {
  const name = _getKarkaRestaurantMealName(meal);
  if (name === undefined) return;
  const price = _getKarkaRestaurantMealPrice(meal) || "Hintaa ei annettu";
  const type = _getKarkaRestaurantMealType(meal);
  const mealObject = { name, price, type };
  return mealObject;
};

const _getKarkaRestaurantMealName = (meal) => {
  const indexOfStartOfFoodClass = meal.indexOf('<span class="food"');
  //Meal name follows immediately after food class
  if (indexOfStartOfFoodClass === -1) return;
  const indexOfStartOfMealName = meal.indexOf(">", indexOfStartOfFoodClass) + 1;

  if (indexOfStartOfMealName === -1) return;
  //check if meal include "food-star" class
  const indexOfStartSpan = meal.indexOf("<span", indexOfStartOfMealName);
  const indexOfEndSpan = meal.indexOf("</span>", indexOfStartOfMealName);
  if (indexOfStartSpan === -1 || indexOfEndSpan === -1) return;
  let indexOfEndOfMealName = indexOfEndSpan;
  if (indexOfStartSpan < indexOfEndSpan) {
    indexOfEndOfMealName = indexOfStartSpan;
  }
  const mealName = meal.slice(indexOfStartOfMealName, indexOfEndOfMealName);
  if (mealName.length < 2) return;
  return mealName;
};

const _getKarkaRestaurantMealPrice = (meal) => {
  const priceGroupClass = 'class="price-group group-';
  const priceGroupClassLength = priceGroupClass.length;
  const indexOfStartOfPriceGroupClass = meal.indexOf(priceGroupClass);
  if (indexOfStartOfPriceGroupClass === -1) return;
  const indexOfStartOfPriceGroup =
    indexOfStartOfPriceGroupClass + priceGroupClassLength;
  const priceGroup = meal.slice(
    indexOfStartOfPriceGroup,
    indexOfStartOfPriceGroup + 1
  );
  const mealPrice = karkaPriceGroups[parseInt(priceGroup) - 1];
  return mealPrice;
};

const _getKarkaRestaurantMealType = (meal) => {
  const vegan = meal.indexOf("Vegaaninen");
  if (vegan !== -1) return karkaMealTypes[0];

  const vegetarian = meal.indexOf("Vegetaarinen");
  if (vegetarian !== -1) return karkaMealTypes[1];

  return karkaMealTypes[2];
};

//Unica restaurants

const assarin_ullakko = "1920";
const macciavelli = "1970";
const galilei = "1995";
const monttu = "1940";
const dental = "1980";
const deli_pharma = "198501";
const delica = "1985";
const linus = "2000";
const kisälli = "1900";
const sigyn = "1965";
const muusa = "196501";
const kulma = "1990";
const piccu_maccia = "197001";

export const unicaRestaurants = [
  assarin_ullakko,
  macciavelli,
  galilei,
  monttu,
  dental,
  deli_pharma,
  delica,
  linus,
  kisälli,
  sigyn,
  //muusa,
  kulma,
  piccu_maccia,
];

const _fetchUnicaRestaurants = async () => {
  let promiseArray = [];
  for (let restaurant of unicaRestaurants) {
    promiseArray.push(_getSingleUnicaRestaurant(restaurant));
  }

  try {
    //Resolved promise array can still contain undefined restaurant objects
    const resolvedPromiseArray = await Promise.all(promiseArray);
    const unicaRestaurants = resolvedPromiseArray.filter((resolvedPromise) => {
      return resolvedPromise !== undefined;
    });
    return unicaRestaurants;
  } catch (e) {
    console.log(e);
    return [];
  }
};

const _getSingleUnicaRestaurant = async (unicaRestaurant) => {
  try {
    const response = await fetch(
      "https://www.unica.fi/modules/json/json/Index?costNumber=" +
        unicaRestaurant +
        "&language=fi",
      {
        mode: "cors",
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
    if (!response.ok) return;
    const json = await response.json();
    if (json?.ErrorText !== null) return;
    return await _createUnicaRestaurantObject(json);
  } catch (e) {
    console.warn(unicaRestaurant, e);
    return;
  }
};

const _createUnicaRestaurantObject = async (unicaRestaurantJson) => {
  //Give default values so if item is not found it doesn't stop from displaying
  const {
    RestaurantName = "",
    RestaurantUrl = "https://www.unica.fi/",
    MenusForDays = null,
  } = unicaRestaurantJson;
  const name = RestaurantName;
  const url = RestaurantUrl;
  let menu = [];
  let openHours = "Ei lounasta tänään";
  let restaurantObject = { name, url, openHours, menu };

  //MenusForDays[0] is the current day's menu

  if (MenusForDays === null || MenusForDays[0]?.SetMenus[0] === undefined)
    return restaurantObject;

  menu = _createUnicaRestaurantMenuArray(MenusForDays[0].SetMenus);
  if (menu.length > 0) {
    openHours = _getUnicaRestaurantOpenHours(MenusForDays[0]);
  }
  restaurantObject = { name, url, openHours, menu };

  return restaurantObject;
};

const _getUnicaRestaurantOpenHours = (menu) => {
  if (menu.LunchTime === (null || undefined)) return "Lounasaikaa ei annettu";
  return menu.LunchTime;
};
const _createUnicaRestaurantMenuArray = (menu) => {
  let readyMenu = [];

  for (const meal of menu) {
    const mealObject = _createUnicaRestaurantMealObject(meal);
    if (mealObject !== undefined) readyMenu.push(mealObject);
  }
  return readyMenu;
};

const _createUnicaRestaurantMealObject = (meal) => {
  const { Name, Price, Components } = meal;
  if (Components === undefined || Components.length === 0) return;
  const name = Components.join("\n");
  const price = Price || "Hintaa ei annettu";
  const type = Name || "Lounas";
  const mealObject = { name, price, type };
  return mealObject;
};

//Sodexo Restaurant

const _formatCurrentMonth = (month) => {
  if (month < 10) month = "0" + month;
  return month;
};

const _formatCurrentDate = (date) => {
  if (date < 10) date = "0" + date;
  return date;
};

const today = new Date();
const fullYear = today.getFullYear();
const month = _formatCurrentMonth(today.getMonth() + 1);
const date = _formatCurrentDate(today.getDate());

const current_date = fullYear + "-" + month + "-" + date;

const _fetchSodexoRestaurants = async () => {
  try {
    const response = await fetch(
      "https://www.sodexo.fi/ruokalistat/output/daily_json/102/" + current_date
    );
    if (!response.ok) return [];
    const json = await response.json();
    const sodexoRestaurantsArray = [_createSodexoRestaurantObject(json)];
    return sodexoRestaurantsArray;
  } catch (error) {
    console.log(error);
    return [];
  }
};

const _createSodexoRestaurantObject = (sodexoRestaurantJson) => {
  let { courses } = sodexoRestaurantJson;

  const name = "Flavoria";
  const url = "https://www.sodexo.fi/ravintolat/flavoria-medisiina-d";
  let openHours = "Ei lounasta tänään";
  let menu = [];

  const lunchServed = _checkIfSodexoLunchServed(courses);

  if (lunchServed) {
    openHours =
      "Lounas MA-PE 10:30-13:30\nKahvila MA-TO 07:30-15:30\nKahvila PE 07:30-14:30";
    menu = _createSodexoRestaurantMenuObject(courses);
  }

  const restaurantObject = { name, url, openHours, menu };
  return restaurantObject;
};

const _checkIfSodexoLunchServed = (courses) => {
  if (courses === null) return false;

  return true;
};

const _createSodexoRestaurantMenuObject = (courses) => {
  let readyMenu = [];
  for (const [key, value] of Object.entries(courses)) {
    readyMenu.push(_createSodexoRestaurantMealObject(value));
  }
  return readyMenu;
};

const _createSodexoRestaurantMealObject = (meal) => {
  const { title_fi, price, category } = meal;
  let meal_price = price || "hintaa ei annettu";
  const name = title_fi || "Ruuan nimi puuttuu";
  const type = category || "Lounas";

  const mealObject = { name, price: meal_price, type };
  return mealObject;
};

//Github Action

let promiseArray = [
  _fetchKarkaRestaurants(),
  _fetchUnicaRestaurants(),
  _fetchSodexoRestaurants(),
];
let promiseAllArray = await Promise.all(promiseArray);
let everyRestaurantData = promiseAllArray[0].concat(
  promiseAllArray[1],
  promiseAllArray[2]
);
let objJsonB64 = Buffer.from(JSON.stringify(everyRestaurantData)).toString(
  "base64"
);
const token = core.getInput("authToken");

const octokit = new Octokit({
  auth: token,
});
const menuFile = await octokit.request(
  "GET /repos/ollitoivanen/OpiskelijalounasWebFetchAction/contents/all_restaurants_menu.json"
);
await octokit.request(
  "PUT /repos/ollitoivanen/OpiskelijalounasWebFetchAction/contents/all_restaurants_menu.json",
  {
    message: "Update menu list.",
    content: objJsonB64,
    sha: menuFile.data.sha,
  }
);
