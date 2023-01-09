# Opiskelijalounas Åbo Fetch Action

## What this is

This is a repository containing a Github Action running once an hour. This action fetches the lunch menus of three main student lunch providers of Turku, Finland from their websites.
It then formats the data to JSON format and pushes it to the [all_restaurants_menu.json](https://github.com/ollitoivanen/OpiskelijalounasWebFetchAction/blob/main/all_restaurants_menu.json)
 -file.
 
 This data is then used by [https://github.com/ollitoivanen/Obiskelijalounas](https://github.com/ollitoivanen/Obiskelijalounas) to populate the website at
 [https://ollitoivanen.github.io/Obiskelijalounas/](https://ollitoivanen.github.io/Obiskelijalounas/)
