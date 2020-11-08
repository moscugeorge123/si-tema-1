# SI tema 1 - Moscu George

## Pentru a putea rula proiectul aveti nevoie de ultima versiune LTS Node.js
https://nodejs.org/en/download/


## Pentru a instala proiectul executati comanda
`npm install` sau mai pe scurt `npm i`, asta dupa ce ati instalat node.js


Pentru a rula serverul `KM`, executati urmatoarea comanda `npm run KM`

Pentru a rula serverul `A`, executati urmatoarea comanda `npm run A`

Pentru a rula serverul `B`, executati urmatoarea comanda `npm run B`


## Proiectul are urmatoarea structura

`A/index.js` - este fisierul care ruleaza clientul `A`

`B/index.js` - este fisierul care ruleaza clientul `B` si serverul `B`

`KM/index.js` - este fisierul care ruleaza clientul `KM` si serverul `KM`

`client.js` - contine codul sursa pentru a crea un client ce se poate conecta la un server

`server.js` - contine codul sursa pentru a crea un server la care se poate conecta un client

`utils.js` - contine codul sursa pentru mai multe functii de tip helper de care se foloseste clientul

`config.js` - contine cheile si IV-urile (pentru OFB) pentru a putea fi manevrate de `KM`

`aes/` - este folderul ce contine:
  - `aes.js` o clasa ce consta in implementarea algoritmului AES pentru a putea fi folosit de `ecb` si `ofb`
  - `ecb.js` o clasa ce consta in implementarea algoritmilor criparii si decriptarii ECB
  - `ofb.js` o clasa ce consta in implementarea algoritmilor criparii si decriptarii OFB
  - `utils.js` o colectie de functii helper pentru algoritmul AES si pentru transformarea datelor in bytes si invers
  - `index.js` fisierul export al fisirelor de mai sus


## Cum rulezi proiectul?

Folosind comezile de mai sus rulam toate cele 3 endpoint-uri.
`Nu poti interactiona cu nici un endpoint pana nu sunt deschise toate 3`

Dupa deschiderea celor 3 endpoint-uri putem interationa doar cu 2 (A si B).

### In nodul A vom putea rula 2 comenzi:
- `request <ofb|ecb>`, ex: `request ecb` - aceasta comanda cere nodului KM config-ul pentru ECB sau OFB. Le va trimite cand va primi request si de la nodul B
- `send <path-to-file>`, ex: `send path/to/file.txt` - va trimite bucati criptate nodului b din fisierul dat ca parametru

Fisierele trimise de nodul a se vor salva in `B/files`.

### In nodul B vom putea rula 2 comenzi:
- `request <ofb|ecb>`, ex: `request ecb` - aceasta comanda cere nodului KM config-ul pentru ECB sau OFB. Le va trimite cand va primi request si de la nodul A


## Tehnologii folosite
- Javascript (server side)
- Websockets
