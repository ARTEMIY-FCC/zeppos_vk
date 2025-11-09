# Zeppos VK  
![VK Logo](https://i.ibb.co/rfLxC9YD/icon.png)  

**VKontakte client for Zepp OS**  

![Screenshot 1](https://i.ibb.co/yFWXC1DC/IMG-2911.png) ![Screenshot 2](https://i.ibb.co/Nd4fsZXt/IMG-2912.png)

A lightweight VK messenger app for Amazfit watches running **Zepp OS**.  
Chat with friends, receive notifications, and stay connected right from your wrist.

---

## Features
- View dialogs and messages  
- Send text messages  

---

## Installation

### 1. Install Zeus CLI
Follow the official guide:  
[Set up development environment](https://docs.zepp.com/docs/guides/quick-start/environment/)

### 2. Clone the repository
```bash
git clone https://github.com/ARTEMIY-FCC/zeppos_vk.git
cd zeppos_vk
```

### 3. Get your VK access token
1. Open [https://vkhost.github.io/](https://vkhost.github.io/)  
2. Click **vk.com**  
   ![vk.com button](https://i.ibb.co/LDpS5zbg/2025-11-09-13-09-59.png)  
3. Log in with your VK account  
4. Copy the token from the URL (the part between `access_token=` and `&expires_in`)  

   **Example:**  
   ```
   vk1.a.1mGUhSMwjoqIs7HXcFPOc-lgoZppChEuZ...L3573pZomSad
   ```

### 4. Insert the token
Open `zeppos_vk/app-side/index.js` and replace  
```js
const ACCESS_TOKEN = "YOUR_VK_TOKEN";
```  
with your actual token:
```js
const ACCESS_TOKEN = "vk1.a.1mGUhSMwjoqIs7HXcFPOc-lgoZppChEuZ...L3573pZomSad";
```

### 5. Preview & install
```bash
zeus preview
```
A QR code will appear in the terminal.  
Scan it using the **Zepp app** on your phone ([guide](https://docs.zepp.com/docs/guides/tools/zepp-app/)).

**Done!** Your VK client is now running on your watch.

---

## Contributing
Feel free to open issues or submit pull requests. Any help improving stability, UI, or adding new features is welcome!

---
Enjoy chatting from your wrist! ⌚💬
```
contact me: artemiy0216@icloud.com
