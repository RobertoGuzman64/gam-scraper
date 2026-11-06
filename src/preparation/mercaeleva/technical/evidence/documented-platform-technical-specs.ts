import { createHash } from "node:crypto";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { validMercaelevaTechnicalSource } from "../mapping/technical.js";

const verifiedUnits: Readonly<Record<string, string>> = {
  "M032-4313": "c860619ceb57b76dec2588abb61a6dc3b93ba9969695e0a006ca149575b16ab9",
  "M051-3155": "91caa1166ac227c6605d4f9c4ba9d4678564d7bbc5734d22220f0dc760fd6019",
  "M106-1389": "7fde3d13bbe00f39ebbc55e2c49ba0e788e5b4c231e48a7e178a09e32c8e0705",
  "M212-3717": "15708631111bfb7bb772465e3c501a94bc6fe36cce0a297cb1c65df07210e526",
  "M237-2621": "79143a143c8a567073a8ef386e00b70bfd6f12c1cf3c1c9b3046ecb5568b22d4",
  "M310-8756": "9f663bedd35190bf5a5dd8888f63830cf897be42df3a958d55f3e7ff8cc0fa86",
  "M352-1310": "5dbace68d80cf9c14a3352303e6a1a166933f65373e190db16728adccac71038",
  "M373-1461": "4c6d932c5131b031ad2d4ad010d85534cfc48c20f081823be900ce04938bc942",
  "M391-7199": "29870991811883d7d29549b5b57d2e5228ac812fd44fbd5af8068fb9a77dda14",
  "M417-9896": "36f39fdba433ee4484829895b34e792b4d6bafb911636a311fa73b2bba75dce7",
  "M448-2901": "86a873d1e71de4350af4fc971b03d2c4fd1f3da5afd637d18d624ffe247e0cc6",
  "M547-8652": "9beb80ef9b5d7813b2b7f04cd6f45466a5e9ee770395270ad292d0bebfb0a9c2",
  "M577-4076": "afb4b84f3e97518d373ee0d1e277fc0c8fa16324c0673adf8bff960421cab51e",
  "M674-6716": "69cbfc9a0f51b5ea2c101b42034ba46c13a202d2d939e7e53e5a4d25380d1603",
  "M696-2742": "0ba185ef1d5eba5f3edcf63dc1164f03feb4e88c19d4b00e27e4ec1dda361f23",
  "M711-4051": "57b61d6183ee2e89c03a398ec57f1e8c28aa9c9d5412711f0ba2f05f9901484e",
  "M726-9929": "400f000b635eda29efc140bc40012929cffa790887924e1d259aa7964828f4f5",
  "M750-3069": "ede7ce9c016486b9810fff3023ecec478d280c00ad193674f1543bc621a34568",
  "M775-6522": "5d4f57c2833f36b7904be554eb30fe3ae24aec9211cb43c287fb3e3ee1a0c8d0",
  "M795-6850": "32831a53f82d239b101ef8dd93968e5203fe9514be0744b461fc7de56b4f3148",
  "M829-6181": "c9818248bf1034adf584a5bd6c91942c4f2fb21d9b89b40bed23ce71c83fc6db",
  "M840-8278": "7465ebe586c659ab79d67086c2b8ef92852f6fb5dce502c4694f42df43068a48",
  "M869-4472": "31b989654fbce5cd06e78cad409182552f5cc115860d6e9173c532d49494d4f4",
  "M873-8524": "803db0c32637335dce112e2442960d9a9b01a9a85225a69dbb66309491072fe5",
  "M931-4108": "29bf0f7c6123374139a5b6d5d54fd6c0f5efa5f577e7c016e21581df941603c9",
  "M988-6161": "12ac4e82545d8bb770b2c75c5a7f47c232bd2614dc405d369415b8f80178e238",
  "M995-8408": "5f465cba650aba88d24bb630f60c6ae510616453a8f1e98575dbad5736de400f",

  "M034-3284": "1019f1b184cfb387581658db60b8f477343ae26ffda9a6e9248460ddffb9d5e0",
  "M050-6081": "555e160c9a4b6d6426a700ccd544a3fd32a780dfb6e8385fab0396f456c7e883",
  "M081-0775": "b22c02735631c50bb3a5902602384e71ff1870c65083eaa9b5f6c2c052ad4264",
  "M091-9536": "81ed50313d60a276959d801c6f5fc257b2c886646247b1063936f2239408c444",
  "M158-2594": "507a07e1085862435131957108d646f8753be3f1163c5be2a82d6098c46a0c2d",
  "M243-5988": "585c51dc10774f82863e8d4412042c5955cce1a9e3cf1fae3eb24e3e7df4483a",
  "M272-6304": "ad63a1674ebf104d9ada8265a5050806c6aa9643df02848c6c404754975158fe",
  "M274-8210": "a99e0ff1ab4322094dfea0d86c7f145ec7bbef9d462bceef855f3d00d7b329bf",
  "M299-2045": "ec7a1d5d7e560e7993192f1849ef0d41f5b0f4cac224c2ac70616dcccd44199c",
  "M308-4683": "a573a88f8779187695480ad07b73bc6f82ca710a3a99f17431903d0c43a8e4b9",
  "M345-0184": "3f2ed68ae0f8d4935d8b901d9de59363087f9676152f094d6295422f8ca47e25",
  "M369-6811": "5ee7aa96c8b8c975b35809b69df2c7660617f41566c031c734cfeeda3bf6c1e7",
  "M380-3644": "006af256a8f7dcc59a8fde6f2001bfd420f880cee2010a77d87fe8c692b2c842",
  "M571-2568": "206d837c8871fd585ac751d0287fa371c18092b965e99898fdfa4815df75f67e",
  "M574-8807": "b1e37d5dcc77028aaff26c8a0f9a13710e2c6400a8d61a4f54e1388d72389582",
  "M620-2142": "414aac00d49ead99eeebed382db7e2d345edcefc0dbd7c72f9fd848388ae588f",
  "M709-8662": "0bedd75bada40d70b04c6605156ef09c42e53979d047467099adce04519affa2",
  "M819-0909": "c34f155356dbbfc9a583343bc2a4d15b4cde8569650391116b0ed09b3ad13b45",
  "M825-8158": "eee723061f940a3c14abe3f4691bdaccc6dde040ccaa66b049d121eeee80c2c6",
  "M911-4028": "b7e0106b343f635ecc790a971faeaa8cf0ffe71de6f3bb12994c3cfd38d268fc",
  "M921-0545": "e7dde24339d632c7cb2919a22bdda4ddda449ad682c61c23ee56bbf45557764f",
  "M922-8615": "672d50133a2e63985c468385e2f60c73d407f387eb9005896b85d340a3eb259a",
  "M953-7579": "a6688d007d27886c6dbdf22811161b99447fafdb81940b4e9c956de134ac0950",
  "M976-1043": "d670455999ab060c9b700bd13080fd8134ee12baed7a27cb55715c969772b9cb",
  "M987-2983": "4fa8d9a07f34ab517dc690e61d457c72c3511b5e920bf19cdf940abadac67d78",
  "M998-5889": "3d3be6b9fed56f9e574784f0cd2f3c6057e80653736b4e4476dc71d45e0ca10c",
  "M131-5855": "b90e548230bb163f56a160ff9562af470980b04daa12bd76349f26f52a9364fb",
  "M281-3486": "e04d15eb30f9a6b8cf3ef59b5a0cccbbb4e6986fd795a8467ea83a4779e06ba6",
  "M229-0241": "e6723daa4e8bc7d3d15a2fd474467e749feba906e9b4aa123fae93f3e224026a",
  "M539-6438": "270c5de6ca044261bc3de88f1d233f982d901401e49fb3f8f185e7c64875d45b",
  "M687-7610": "16703655554aa35a848623044bbd1b60bb4067d5e445c73f4d4b775b7723be84",
  "M517-8202": "b36445296b245e28dd91060f4635062b3c99c4673b529f4a10229022cd6fa1f4",
  "M778-4251": "efd913aaa2531dbd5513895287b7fcb9bb330d100aeb9388654380162c068d9a",
  "M201-8398": "f4f2099eda4e427309e89d4009db9d48dd128e1ab39b4cd6334c892abe370fec",
  "M690-8650": "9ff864216662579d81ba1aed28f44737cf61038a28a01214e241a90aca6154ab",
  "M715-6049": "094820244ea080db52f3df59624865df17e8cdd55cf10394144375598d2344ec",
  "M028-0455": "84cdac6817e8c000ce9dc1634823ca1f74dd139df6fa32c6c06ad638a1e985a6",
  "M621-1566": "04e7558690058587df4048a52a0e06c486ab15897d6b06201586ec1be907b9a0",
  "M594-9948": "446055aafdc3906488ea690f3370567cc962a2a3179058e3ed6f014942b1bdff",
  "M095-5362": "47b9fafbc9c5e600b6eb802831dbf747671b876e6184d3681f0b5d69103e9be1",
  "M171-6370": "a87a429180f1c3b6830450a7a64e339f89e1bb6ffb2f51fd256f8217b2c0056a",
  "M144-5512": "b8e3e00692c56ebf805b6718535ffe6e3255d72d127b5e1648d71c14e7bf0e70",
  "M309-0364": "bd5795abb27020e7704cbbb648e67f3478cc6f574bb0080a6661fad5ab43981c",
  "M040-2258": "62f8c1f78fc6de83cb11a22fefd570c5102cb669a7114a409a28a50d106081c7",
  "M563-8693": "8d2a2c2c36aea261aad341ee1f0c86b90d5ef9bf63b51596e4d443261d8989b8",
  "M008-1528": "f93beda0a8d4bb76a764c05eb9b0a8209342458723b0042a1ca3dc48012fd194",
  "M000-3684": "55b6d71df27002ffbdbc9a3df50bf1b5e5d0689b4e870b7fc8262bc2c0451d26",
  "M236-6155": "3ef315bb5d6aeb6c5b29a3b8ce2b7f9fc639077ea352538fbde3ac8ff2351ee4",
  "M037-5798": "f42349b6226204ae1cb041603e4bae132ca938fe5ad8989038ea850cc4e87fe1",
  "M835-4459": "a9ef152a3a2c419d0e5eef692fd914d29e45918dc2adaec90cefea4e5cfc972d",
  "M887-9469": "c82af17d11ddf578232cfbf8632c3d5093bf69fd56e752b25f0c5b82c2b33436",
  "M384-3098": "088ba7864152ddcb07550ea1b31e630363c6e2df2baec81df374e41e4d200b09",
  "M408-7290": "8b49686607fada4c9fc591736fc69abc8385806c44773c65e9d135a393c72da9",
  "M598-6695": "d13e6aa4b716ed2eff46941a5e3f0c149724705c673042772a1964a9d3ce6775",
  "M107-1791": "aa16841b15bab3e8edbe3902dac7ffc92142f9238c204afa4b95f5253ef26a25",
  "M811-9996": "0c9ccb09d095633a72483ec3ec324c8fbbcc36046172698d79d10a9abed0423d",
  "M030-7485": "1d7bb300a26dc300ad3e0fcfe13ec69b047231ecd4d6dd1e7d51067ddc7065d4",
  "M026-2648": "1efd51edf3872be2f585e6a73027a83326564f21486a80eda6b3cb8f62e51e81",
  "M904-5325": "d01f9e1ec0a6999bde42297c3786cc782c69877c21b07502164d5e7c82347eb5",
  "M057-0589": "79558d4022b1266d71c73034523298d711a7c10f5c94c8749c4106d2973c4501",
  "M186-5711": "d214ea17f578c3c83190a2fa0264f41f59b3926480dfb9ad8660bc6d7351d179",
  "M416-1048": "b44e89ab72044b0cba4a612efea647525580937dec7b05b99b4ee9439222e483",
  "M510-3631": "3c4251a24454008eb631fa705c1bb7538cb69432a29309696907678a1fc27c73",
  "M106-2983": "fc1429155269c174547d3670e627d33d827f3a956fc9880dcc1a95941a600f37",
  "M879-0952": "5025444a9ac3b9c996acbf18435a29866435aa6fe743ea06bed8b6f7724297de",
  "M572-8190": "f3fc2f2ec73092f39e2bd292d65284e27fbdf1702cb54e6b01a574586b0e225e",
  "M205-2951": "f77c1cce91035b7b882fffcdb900dc0e690835fa850cb6bdb01322630f7694d6",
  "M178-6194": "0d47018e34422d3779f05bd4e96a7de916c0bb3d1fd0eb119ceb6b13812becaa",
  "M342-3553": "cb32b69edaa10cf7ff1061d3805e1a681b5d5f77528f656d8c42f0c71f00b01f",
  "M045-6952": "0a6efe407a64b543114ce4544000ed47c7e3009f98d7dc7a6fd97d061931c1fa",
  "M763-8737": "9dd998896dc38fd2a41df1333c09a4949e41133f7bc138d804d55f45cf18ffe1",
  "M417-2082": "9f552513f1ba032c88aa8a244980d620aa3f1c20033c5272ca8ea1b48e5261ce",
  "M282-6906": "a61cd6c8d8d94d1407d770e0f2741d729d842de1ab5f7695e13335e649a3c2bb",
  "M439-8484": "c9b98734c633f1ac3b77040b881a98bcc958019ecf4399901f38f2e2b64f3cc3",
  "M203-6152": "72175ba69c98d2471fd24a7f10603ee7b74d3adc1bd6b9415f3436678c36914d",
  "M544-7437": "e129e7b4d5ac80c55936a0b95016f896b83e9f224c62cb6e047ed4efddd6048e",
  "M659-0840": "a05d8871203a568f70ed712014781dbd6501feefb6729828b7f11b9ab01d5e1a",
  "M004-3667": "73a4b7b4e50b69f596ca9f012ec6c7839d4ea9a5ad0ac686bff4c1779a32ac55",
  "M845-8651": "7eed6ea4ad940647c9fd6286bf4ec1b55b927f9000c1f275c2f02f1fd2c89425",
  "M038-6763": "d1f023a2b40e8044e68b9487808428baadd318ff1539246b7c66699a84b2e756",
  "M116-2363": "02441ccf4bd698e206108506ddee148acb33823e5296ca66c3c8e094cd22fe03",
  "M099-6166": "e44119023803dbbfcadad9d1bed2cbe289a2dfa540d906fa97f6394219ad2047",
  "M256-1875": "5181600fcc656492139d2f5345bbc44f0a6da47cdd4710132960a4c88f7a4968",
  "M110-1645": "0291e35aadbc8bbb9d3678da32eae20f5d852a2a96aa50bcacdfe6e51f37fef9",
  "M160-4528": "4052bb7aeaaca9ee1412eba49502496b741fa421b220c7a6713e0a721ad05f77",
  "M122-9495": "cda4387d7de1a810683117b97b6245d28dec2aada723fec1a682d11f440b3c76",
  "M579-7579": "3f158a88008349b34f5accf5cabc6c771fdcee3c4d90d237aba950ac7c4a3287",
  "M168-7445": "e7e991552b977f7e909400b854606ff87ed17fa23d288fff92179411b02ed88e",
  "M317-3748": "918c87e3bf23d3ffbbb52742a6ed12c38c3c08c7c242b4be347cf454fecd77ae",
  "M692-8041": "22a990365031b3e6838a1c19edc2446f0c216882bcf6caae5c5eb7dece527594",
  "M932-2445": "417bd42c466f097022fc11cd9a1d52c1e938fb77f576299c7121408556837387",
  "M725-7107": "77ec1ebae3137e23caa16e3595cacfb8bcd0185765e2975a09acec14cc5fdf16",
  "M749-9513": "0877e0b18f4f788f52c660dcb7747ac2097fc5a26a0cabc8d82094d2028744fa",
  "M082-6111": "944c3db5b1de129c8ff734b76a7ad795240a8be082203b1bea189f66f5e97804",
  "M140-0406": "f8bb683e9994ea92e36b92f4296e006c3ea1dea245a1415c69a96778b852cb30",
  "M082-5310": "81084c4c36e7ebe653ac52d76a62c7560bf9be611b618b37ffd63299fd835f61",
  "M264-2806": "80a657a98d1278b44d27e41e64525f463f0f5b71d85648c38c243a5ff7c6ab1b",
  "M018-7013": "68a3ead7033b3b3c92d0f0968ee09cfcdd084a12533ad9b2bfe0c676aef2dade",
  "M091-1956": "ecd06b083a109f4bfa581a3ae0d8766f871360eddf7db98453e6ab593916f15a",
  "M209-3306": "0d40faa1fa205be0ab872d775b0784b54aa40340fd4af78ce4dde9215e49bd58",
  "M451-2844": "184434d02ad05334131ca6b45a24274e38556802afda0ba2d53aa74d2972161b",
  "M829-9712": "491cc7617e112ebc0ca894e3eba58d09d90edbb62db7a3e6330165ad12a422a4",
  "M549-6792": "39b62682a3387af66d2ee8db708ffec346dc272951d99370232e66ac521cc625",
  "M622-7084": "0fa61a275256a6ecf0754a2f332a374006b3d2e7c209f2e8aecaf228b6b7a094",
  "M624-7785": "1605979f6c4d9f533844ceb0e03c4a8416dac2108a3f5fed8db0b19a4ae48cdd",
  "M579-8838": "f667c914602fc9703d0c2a10f6d0fe6c5f3c5147ac69bddff9c76fd2439442e7",
  "M055-3461": "4e0ebdbefa6a790844254c36f426e13109c01969afe59da77e2e8489b2329416",
  "M380-2365": "18d2a501367af24d09320c426733743f099a80498e5d325978d858c52106d44e",
  "M479-8138": "b37390b7ba91520cc56f61cc016d609a6c83306906af5b9530d35a022c10690d",
  "M567-8260": "bbf820701be607b0e189a35081f14a614ea2ac660b6d45b4f432a88643147430",
  "M584-9410": "153662ec69c41d4529642f9496d0cdf5fa9f9ab3823ac6d56b605400a68e5beb",
  "M971-8124": "d8ce273d235faf758737f76bf17a063bff375c977d7403db43d93bbe9ae5b448",
  "M665-4166": "82cd2b26b8b40ee043d252d1856b1862d311f5b573cfcfdc34a8d58d18a6483f",
  "M805-9451": "ab6bbe92408d32e724ad41fe7367794a16f0d10c273691ac1616635938f30c23",
  "M141-6600": "c5b421791f16273c7d87236ddbf12d82d927eb24cff502b22c169ab86563f849",
  "M061-0041": "801fa188d83440e2ad866cf0c9464cf44b2846b6ac18d0b13e2de3659cce3dbe",
  "M731-0501": "7fd1a4041b2552a0491faebf3e657dd7b62f27e70fc044d720783ced952e0f64",
};

const profiles = [
  {
    brand: "JLG", model: "1930 ES", workHeight: "8 m", motor: "Eléctrico",
    title: "PLATAFORMA TIJERA ELECTRICA 8 MT",
    source: "https://jlg.ru/upload/iblock/455/4553b4c82a42f5acb598bdded07318e7.pdf",
    specifications: { "Altura de plataforma": "5,72 m", "Anchura total": "0,76 m" }
  },
  {
    brand: "JLG", model: "1930ES", workHeight: "8 m", motor: "Eléctrico",
    title: "PLATAFORMA DE TIJERA ELECTRICA",
    source: "https://csapps.jlg.com/OnlineManuals/Manuals/JLG/JLG%20Scissor%20Lifts/ES%20Scissors/1930ES_2030ES_2032ES_2630ES_2632ES_2646ES_3246ES/Operation%20Manuals/Prior%20to%20SN%200200239382%2C%20B200020297%2C%20and%201200025021/Operation_3121165_05-01-13_Global_English.pdf",
    specifications: { "Altura de plataforma": "5,7 m", "Anchura total": "0,76 m" }
  },
  {
    brand: "Haulotte", model: "HA12IP", workHeight: "12 m", motor: "Eléctrico",
    title: "PLATAFORMA ARTICULADA ELECTRICA 12 MT",
    source: "https://used-equipement.haulotte.com/images/atts/06e712_ha12ip-uk-bd.pdf",
    specifications: { "Altura de plataforma": "10 m", "Alcance horizontal": "6,5 m" }
  },
  {
    brand: "Manitou", model: "170AETJL", workHeight: "17 m", motor: "Eléctrico",
    title: "PLATAFORMA ARTICULADA ELECTRICA 17 MT",
    source: "https://www.rentalift.be/fileadmin/user_upload/Technische-Fiche-Manitou-170-AETJ-L.pdf",
    specifications: { "Altura de plataforma": "14,9 m", "Alcance horizontal": "9,4 m" }
  },
  {
    brand: "JLG", model: "450 AJ", workHeight: "16 m", motor: "Diesel",
    title: "PLATAFORMA ARTICULADA DIESEL 16 MT",
    source: "https://www.rentalift.be/fileadmin/user_upload/Technische-Fiche-JLG-450AJ.pdf",
    specifications: { "Altura de plataforma": "13,72 m", "Alcance horizontal": "7,47 m" }
  },
  {
    brand: "Haulotte", model: "COMPACT-10N", workHeight: "10 m", motor: "Eléctrico",
    title: "PLATAFORMA TIJERA ELECTRICA 10 MT",
    source: "https://gorentalstore.com/alquiler/plataforma-electrica-de-tijera-de-10-m/ficha-de-datos-tecnicos",
    specifications: { "Altura de plataforma": "8 m", "Anchura total": "0,81 m" }
  },
  {
    brand: "Haulotte", model: "HA15IP", workHeight: "15 m", motor: "Eléctrico",
    title: "PLATAFORMA ARTICULADA ELECTRICA 15 MT",
    source: "https://www.megaltura.com/wp-content/uploads/2022/08/HAI15IP-Haulotte.pdf",
    specifications: { "Alcance horizontal": "8,45 m", "Capacidad máxima de plataforma": "230 kg" }
  },
  {
    brand: "Haulotte", model: "HA16RTJ", workHeight: "16 m", motor: "Diesel",
    title: "PLATAFORMA ARTICULADA DIESEL 16 MT",
    source: "https://www.haulotte.com.es/es_ES/productos/ha16-rtj",
    specifications: { "Altura de plataforma": "14 m", "Alcance horizontal": "8,3 m" }
  },
  {
    brand: "Haulotte", model: "Optimum 8", workHeight: "8 m", motor: "Eléctrico",
    title: "PLATAFORMA TIJERA ELECTRICA 8 MT",
    source: "https://www.haulotte.com.es/es_ES/productos/optimum-8",
    specifications: { "Capacidad máxima de plataforma": "230 kg", "Distancia entre ejes": "1,38 m" }
  },
  {
    brand: "Haulotte", model: "Compact 12", workHeight: "12 m", motor: "Eléctrico",
    title: "PLATAFORMA TIJERA ELECTRICA 12 MT",
    source: "https://www.eagleplatforms.com/wp-content/uploads/Haulotte-Compact-12-Electric-SPEC-SHEET.pdf",
    specifications: { "Anchura total": "1,2 m", "Distancia entre ejes": "1,86 m" }
  },
  {
    brand: "Haulotte", model: "COMPACT-14", workHeight: "14 m", motor: "Eléctrico",
    title: "PLATAFORMA TIJERA ELECTRICA 14 MT",
    source: "https://used-equipement.haulotte.com/haulotte/se/construction/scissor-lifts/haulotte-compact14/43b3bfb2-a028-4881-821d-fd1288a4be18.html",
    specifications: { "Altura de plataforma": "11,85 m", "Anchura total": "1,2 m" }
  },
  {
    brand: "Haulotte", model: "STAR-10", workHeight: "10 m", motor: "Eléctrico",
    title: "PLATAFORMA VERTICAL AUTOPROPULSADA 10 MT",
    source: "https://marconnet.nc/wp-content/uploads/2019/11/HAULOTTE-STAR-10-fiche.pdf",
    specifications: { "Altura de plataforma": "8 m", "Alcance horizontal": "3 m" }
  },
  {
    brand: "LGMG", model: "S0808EII", workHeight: "10 m", motor: "Eléctrico",
    title: "PLATAFORMA TIJERA ELECTRICA 10 MT",
    source: "https://www.lgmglifts.com/es/product/pro-detail-2066.htm",
    specifications: { "Anchura total": "0,83 m", "Capacidad máxima de plataforma": "230 kg" }
  },
  {
    brand: "LGMG", model: "AS1212E", workHeight: "14 m", motor: "Eléctrico",
    title: "PLATAFORMA TIJERA ELECTRICA 14 MT",
    source: "https://en.lgmg.com.cn/product/625.htm",
    specifications: { "Altura de plataforma": "12 m", "Anchura total": "1,18 m" }
  },
  {
    brand: "LGMG", model: "AR16J", workHeight: "18 m", motor: "Diesel",
    title: "PLATAFORMA ARTICULADA DIESEL 18 MT",
    source: "https://www.lgmglifts.com/product/pro-detail-617.htm",
    specifications: { "Altura de plataforma": "15,7 m", "Alcance horizontal": "9,39 m" }
  },
  {
    brand: "LGMG", model: "A14JE", workHeight: "16 m", motor: "Eléctrico",
    title: "PLATAFORMA ARTICULADA ELECTRICA 15 MT",
    source: "https://www.lgmglifts.com/product/pro-detail-616.htm",
    specifications: { "Altura de plataforma": "13,8 m", "Alcance horizontal": "7,81 m" }
  },
  {
    brand: "LGMG", model: "A14JE", workHeight: "16 m", motor: "Eléctrico",
    title: "PLATAFORMA ARTICULADA ELECTRICA 16 MT",
    source: "https://www.lgmglifts.com/product/pro-detail-616.htm",
    specifications: { "Altura de plataforma": "13,8 m", "Alcance horizontal": "7,81 m" }
  },
  {
    brand: "Genie", model: "Z-80/60", workHeight: "26 m", motor: "Diesel",
    title: "PLATAFORMA ARTICULADA DIESEL 26 MT",
    source: "https://www.genielift.com/docs/default-source/product-specifications/articulated-boom-lift/es/z-80_60-especificaciones-t%C3%A9cnicas.pdf?sfvrsn=9c0eb8ce_4",
    specifications: { "Alcance horizontal": "18,29 m", "Capacidad máxima de plataforma": "227 kg" }
  },
  {
    brand: "JLG", model: "E300AJP", workHeight: "11 m", motor: "Eléctrico",
    title: "PLATAFORMA ARTICULADA ELECTRICA 11 MT",
    source: "https://csapps.jlg.com/OnlineManuals/Manuals/JLG/JLG%20Boom%20Lifts/E300A_E300AJ_E300AJP/Operation%20Manuals/SN%200300000100%20to%200300138357/Operation_3121214_12-10-09_Global_English.pdf",
    specifications: { "Altura de plataforma": "9,14 m", "Anchura total": "1,22 m" }
  },
  {
    brand: "LGMG", model: "SR1218D", workHeight: "14 m", motor: "Diesel",
    title: "PLATAFORMA TIJERA DIESEL 14 MT",
    source: "https://www.lgmglifts.com/product/pro-detail-1028.htm",
    specifications: { "Altura de plataforma": "11,9 m", "Anchura total": "1,79 m" }
  },
  {
    brand: "Manitou", model: "120AETJC", workHeight: "12 m", motor: "Eléctrico",
    title: "PLATAFORMA ARTICULADA ELECTRICA 12 MT",
    source: "https://www.colle.eu/media/6008/120aetj-c-eng.pdf",
    specifications: { "Altura de plataforma": "9,95 m", "Capacidad máxima de plataforma": "200 kg" }
  },
  {
    brand: "Manitou", model: "180ATJ", workHeight: "18 m", motor: "Diesel",
    title: "PLATAFORMA ARTICULADA DIESEL 18 MT",
    source: "https://www.colle.eu/media/6020/180atj_eng.pdf",
    specifications: { "Alcance horizontal": "10,62 m", "Capacidad máxima de plataforma": "230 kg" }
  },
  {
    brand: "Skyjack", model: "SJ6832RT", workHeight: "12 m", motor: "Diesel",
    title: "PLATAFORMA TIJERA DIESEL 12 MT",
    source: "https://www.skyjack.com/sites/default/files/literature-library/KC_SJ6832_RT_TEAR_SHEET_WEB.pdf",
    specifications: { "Altura de plataforma": "9,75 m", "Capacidad máxima de plataforma": "454 kg" }
  },
  {
    brand: "Genie", model: "GS2632", workHeight: "10 m", motor: "Eléctrico",
    title: "PLATAFORMA TIJERA ELECTRICA 10 MT",
    source: "https://www.genielift.com/docs/default-source/product-specifications/slab-scissor-lifts-%28ansi%29-or-electric-and-bi-energy-lifts-%28ce%29/ja/spec-sheet-hydraulic-gs--2032_-gs-2632-_-gs-3232-%282020%E5%B9%B4%E4%BB%A5%E5%89%8D%E3%81%AE%E3%83%A2%E3%83%87%E3%83%AB%29.pdf?sfvrsn=d435f9cd_5",
    specifications: { "Altura de plataforma": "7,92 m", "Anchura total": "0,81 m" }
  },
  {
    brand: "Genie", model: "GS4390RT", workHeight: "15 m", motor: "Diesel",
    title: "PLATAFORMA TIJERA DIESEL 15 MT",
    source: "https://www.genielift.com/docs/default-source/product-specifications/rough-terrain-scissor-lifts/en/gs-3390rt_4390rt_5390rt_specsheet_2019.pdf?sfvrsn=793c8daf_6",
    specifications: { "Altura de plataforma": "13,11 m", "Capacidad máxima de plataforma": "680 kg" }
  },
  {
    brand: "Haulotte", model: "COMPACT-10", workHeight: "10 m", motor: "Eléctrico",
    title: "PLATAFORMA TIJERA ELECTRICA 10 MT",
    source: "https://www.hirosgepber.hu/letoltesek/haulotte-compact-10-12.pdf",
    specifications: { "Capacidad máxima de plataforma": "450 kg", "Distancia entre ejes": "1,86 m" }
  },
  {
    brand: "Genie", model: "GS5390RT", workHeight: "18 m", motor: "Diesel",
    title: "PLATAFORMA TIJERA DIESEL 18 MT",
    source: "https://www.genielift.com/en/aerial-lifts/rough-terrain-scissor-lifts/gs5390rt",
    specifications: { "Altura de plataforma": "16,15 m", "Capacidad máxima de plataforma": "680 kg" }
  },
  {
    brand: "Haulotte", model: "HA260PX", workHeight: "26 m", motor: "Diesel",
    title: "PLATAFORMA ARTICULADA DIESEL 26 MT",
    source: "https://arnouldmanutention.be/fiches-techniques/fiche-technique-nacelle-telescopique-haulotte-ha260px.pdf",
    specifications: { "Altura de plataforma": "23,6 m", "Alcance horizontal": "16,2 m" }
  },
  {
    brand: "Manitou", model: "MAN GO 12", workHeight: "12 m", motor: "Diesel",
    title: "PLATAFORMA ARTICULADA DIESEL 12 MT",
    source: "https://www.manitou.com/en-GR/our-machines/mobile-elevating-work-platforms/mango-12",
    specifications: { "Altura de plataforma": "9,9 m", "Capacidad máxima de plataforma": "230 kg" }
  },
  {
    brand: "Genie", model: "Z-34/22N", workHeight: "12 m", motor: "El\u00e9ctrico",
    title: "PLATAFORMA ARTICULADA ELECTRICA 12 MT",
    source: "https://manuals.genielift.com/operators/english/82597.pdf",
    specifications: { "Altura de plataforma": "10,5 m", "Capacidad máxima de plataforma": "227 kg" }
  },
  {
    brand: "Haulotte", model: "COMPACT-12DX", workHeight: "12 m", motor: "Diesel",
    title: "PLATAFORMA TIJERA DIESEL 12 MT",
    source: "https://www.haulotte.co.uk/en_GB/product/compact-12-dx",
    specifications: { "Altura de plataforma": "10,06 m", "Capacidad máxima de plataforma": "450 kg" }
  },
  {
    brand: "Genie", model: "Z-62/40", workHeight: "20 m", motor: "Diesel",
    title: "PLATAFORMA ARTICULADA DIESEL 20 MT",
    source: "https://www.genielift.com/en/aerial-lifts/articulated-boom-lifts/z6240",
    specifications: { "Alcance horizontal": "12,42 m", "Capacidad máxima de plataforma": "227 kg" }
  },
  {
    brand: "Haulotte", model: "HA32PX", workHeight: "32 m", motor: "Diesel",
    title: "PLATAFORMA ARTICULADA DIESEL 32 MT",
    source: "https://documentacionqr.com/sat/objects/3588/HAULOTTE_HA32PX_MANUAL_OPERARIO_ES.PDF",
    specifications: { "Altura de plataforma": "29,8 m", "Capacidad máxima de plataforma": "250 kg" }
  },
  {
    brand: "JLG", model: "460SJ", workHeight: "16 m", motor: "Diesel",
    title: "PLATAFORMA TELESCOPICA DIESEL 16 MT",
    source: "https://csapps.jlg.com/OnlineManuals/Manuals/JLG/JLG%20Boom%20Lifts/400S_460SJ/Operation%20Manuals/SN%200300000100%20to%200300203770/3121216%20400S%20460SJ%20JLG%20Operation%204-28-22%20English.pdf",
    specifications: { "Altura de plataforma": "14 m", "Anchura total": "1,98 m" }
  },
  {
    brand: "Hollandlift", model: "HL-220 E12", workHeight: "22 m", motor: "El\u00e9ctrico",
    title: "PLATAFORMA TIJERA ELECTRICA 22 MT",
    source: "https://www.lectura-specs.es/es/modelo/plataformas-elevadoras/plataformas-de-tijera-plataformas-de-tijeras-de-ruedas-holland-lift/hl-220-e12-11704863",
    specifications: { "Anchura total": "1,2 m", "Capacidad máxima de plataforma": "500 kg" }
  },
  {
    brand: "Oil & Steel", model: "SCORPION 1490", workHeight: "15 m", motor: "Diesel",
    title: "CAMION CESTA TELESCOPICO ALUMINIO 15 MT",
    source: "https://www.lectura-specs.com/en/model/aerial-work-platform/telescopic-boom-lifts-truck-mounted-telescopic-boom-lifts-oil-steel/scorpion-1490-11697689",
    specifications: { "Alcance horizontal": "9,2 m", "Anchura de plataforma": "0,7 m" }
  },
  {
    brand: "JLG", model: "1250AJP", workHeight: "40 m", motor: "Diesel",
    title: "PLATAFORMA ARTICULADA DIESEL 40 MT",
    source: "https://jlg.ru/upload/iblock/a55/a55ac022eb564236eb1714d950c513c3.pdf",
    specifications: { "Altura de plataforma": "38,3 m", "Alcance horizontal": "19,25 m" }
  },
  {
    brand: "JLG", model: "800AJ", workHeight: "26 m", motor: "Diesel",
    title: "PLATAFORMA ARTICULADA DIESEL 26 MT",
    source: "https://sitecore.jlg.com/dfsmedia/e4042b10c9ce4595b4cc059f1299f079/142288-source",
    specifications: { "Altura de plataforma": "24,38 m", "Alcance horizontal": "15,8 m" }
  },
  {
    brand: "JLG", model: "660SJ", workHeight: "22 m", motor: "Diesel",
    title: "PLATAFORMA TELESCOPICA DIESEL 22 MT",
    source: "https://www.accesshire.net/specifications/telescopic_boom/diesel/JLG_Telescopic_Boom_Lift_660SJ_20150904.pdf",
    specifications: { "Altura de plataforma": "20,31 m", "Alcance horizontal": "17,3 m" }
  },
  {
    brand: "JLG", model: "2630ES", workHeight: "10 m", motor: "Eléctrico",
    title: "PLATAFORMA TIJERA ELECTRICA 10 MT",
    source: "https://www.megaltura.com/wp-content/uploads/2022/08/JLG-2630-ES.pdf",
    specifications: { "Altura de plataforma": "7,77 m", "Anchura total": "0,76 m" }
  },
  {
    brand: "JLG", model: "860SJ", workHeight: "28 m", motor: "Diesel",
    title: "PLATAFORMA TELESCOPICA DIESEL 28 MT",
    source: "https://www.jlg.com/en/equipment/boom-lifts/telescopic/engine-powered/800-series/860sj",
    specifications: { "Altura de plataforma": "26,21 m", "Alcance horizontal": "22,86 m" }
  },
  {
    brand: "JLG", model: "3394RT", workHeight: "12 m", motor: "Diesel",
    title: "PLATAFORMA TIJERA DIESEL 12 MT",
    source: "https://www.malarlift.se/wp-content/uploads/2013/04/JLGSpecifications-Guide-Diesel-Range-EN.pdf",
    specifications: { "Altura de plataforma": "10,06 m", "Anchura total": "2,39 m" }
  },
  {
    brand: "JLG", model: "E600JP", workHeight: "20 m", motor: "Eléctrico",
    title: "PLATAFORMA ARTICULADA ELECTRICA 20 MT",
    source: "https://sitecore.jlg.com/dfsmedia/e4042b10c9ce4595b4cc059f1299f079/140840-source",
    specifications: { "Alcance horizontal": "13,54 m", "Capacidad máxima de plataforma": "227 kg" }
  },
  {
    brand: "JLG", model: "1350 SJP", workHeight: "43 m", motor: "Diesel",
    title: "PLATAFORMA TELESCOPICA DIESEL 43 MT",
    source: "https://www.manualslib.com/manual/1277304/Jlg-1350sjp.html",
    specifications: { "Altura de plataforma": "41,2 m", "Alcance horizontal máximo sin restricción de carga": "24,4 m" }
  },
  {
    brand: "Genie", model: "Z-51/30J", workHeight: "18 m", motor: "Diesel",
    title: "PLATAFORMA ARTICULADA DIESEL 18 MT",
    source: "https://manuals.genielift.com/operators/english/219413.pdf",
    specifications: { "Altura de plataforma": "15,59 m", "Capacidad máxima de plataforma": "227 kg" }
  },
  {
    brand: "Genie", model: "Z-45/25J", workHeight: "16 m", motor: "Diesel",
    title: "PLATAFORMA ARTICULADA DIESEL 16 MT",
    source: "https://manuals.genielift.com/operators/english/114340.pdf",
    specifications: { "Capacidad máxima de plataforma": "227 kg", "Anchura de plataforma": "0,76 m" }
  },
  {
    brand: "Genie", model: "Z-30/20N", workHeight: "11 m", motor: "Eléctrico",
    title: "PLATAFORMA ARTICULADA ELECTRICA 11 MT",
    source: "https://manualzilla.com/doc/6014943/from-sn-951-to-6289--z-30-20n--pn-43651-",
    specifications: { "Altura de plataforma": "9,1 m", "Capacidad máxima de plataforma": "227 kg" }
  },
  {
    brand: "Genie", model: "Z-30/20NRJ", workHeight: "11 m", motor: "Eléctrico",
    title: "PLATAFORMA ARTICULADA ELECTRICA 11 MT",
    source: "https://www.mateco.es/fileadmin/user_upload/Guia-de-alquiler-2019.pdf",
    specifications: { "Altura de plataforma": "8,89 m", "Alcance horizontal": "6,25 m" }
  },
  {
    brand: "Genie", model: "GS2646", workHeight: "10 m", motor: "Eléctrico",
    title: "PLATAFORMA TIJERA ELECTRICA 10 MT",
    source: "https://manuals.genielift.com/operators/english/82785.pdf",
    specifications: { "Altura de plataforma": "7,9 m", "Anchura total": "1,17 m" }
  },
  {
    brand: "Genie", model: "GS3246", workHeight: "12 m", motor: "Eléctrico",
    title: "PLATAFORMA TIJERA ELECTRICA 12 MT",
    source: "https://manuals.genielift.com/operators/english/82785.pdf",
    specifications: { "Altura de plataforma": "9,75 m", "Anchura total": "1,17 m" }
  },
  {
    brand: "Genie", model: "S-125", workHeight: "40 m", motor: "Diesel",
    title: "PLATAFORMA TELESCOPICA DIESEL 40 MT",
    source: "https://www.hulleman.com/en/stock/genie-s-125-40-meter-227-kg-53046243.pdf",
    specifications: { "Altura de plataforma": "38,1 m", "Alcance horizontal": "24,38 m" }
  },
  {
    brand: "Genie", model: "GS4390", workHeight: "15 m", motor: "Diesel",
    title: "PLATAFORMA TIJERA DIESEL 15 MT",
    source: "https://www.genielift.com/docs/default-source/product-specifications/rough-terrain-scissor-lifts/en/gs-3390rt_4390rt_5390rt_specsheet_2019.pdf?sfvrsn=793c8daf_6",
    specifications: { "Altura de plataforma": "13,11 m", "Capacidad máxima de plataforma": "680 kg" }
  },
  {
    brand: "Genie", model: "S-65", workHeight: "22 m", motor: "Diesel",
    title: "PLATAFORMA TELESCOPICA DIESEL 22 MT",
    source: "https://manuals.genielift.com/Operators/english/114305.pdf",
    specifications: { "Altura de plataforma": "19,8 m", "Capacidad máxima de plataforma": "227 kg" }
  },
  {
    brand: "Haulotte", model: "HA20PX", workHeight: "20 m", motor: "Diesel",
    title: "PLATAFORMA ARTICULADA DIESEL 20 MT",
    source: "https://www.grarasulin.com/wp-content/uploads/2023/05/ha20px_uk_bda0a.pdf",
    specifications: { "Altura de plataforma": "18,65 m", "Alcance horizontal": "13,5 m" }
  },
  {
    brand: "Manitou", model: "200ATJ", workHeight: "20 m", motor: "Diesel",
    title: "PLATAFORMA ARTICULADA DIESEL 20 MT",
    source: "https://www.lectura-specs.com/en/model/aerial-work-platform/articulating-boom-lifts-wheeled-articulating-boom-lifts-manitou/200-atj-1161009",
    specifications: { "Alcance horizontal": "12 m", "Capacidad máxima de plataforma": "230 kg" }
  },
  {
    brand: "Manitou", model: "160ATJ", workHeight: "16 m", motor: "Diesel",
    title: "PLATAFORMA ARTICULADA DIESEL 16 MT",
    source: "https://malarlift.se/wp-content/uploads/2013/04/160_163134140-Manitou-Diesel-Aerial-Work-Platforms-EN.pdf",
    specifications: { "Capacidad máxima de plataforma": "230 kg", "Anchura de plataforma": "0,8 m" }
  }
] as const;

const sourceFingerprint = (record: ProductRecord): string => createHash("sha256").update(JSON.stringify({
  reference: record.reference,
  url: record.url,
  title: record.title,
  brand: record.brand,
  model: record.model,
  year: record.year,
  condition: record.condition,
  horometer: record.horometer,
  longDescription: record.longDescription,
  specs: record.specs
})).digest("hex");

export const recoverMercaelevaDocumentedPlatformTechnicalSpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  if (!validMercaelevaTechnicalSource(record) || record.categoryKey !== "venta" ||
    record.condition !== "Segunda mano" || !record.reference || !record.specs ||
    verifiedUnits[record.reference] !== sourceFingerprint(record) ||
    !record.url.endsWith(`-${record.reference}`) || !record.year ||
    record.specs["Año de fabricación"] !== record.year ||
    record.specs["Marca"] !== record.brand || record.specs["Modelo"] !== record.model) return specs;

  const profile = profiles.find((entry) => entry.brand === record.brand && entry.model === record.model && entry.title === record.specs?.["Título adicional"]);
  if (!profile || record.specs["Título adicional"] !== profile.title ||
    record.specs["Tipo de motor"] !== profile.motor || record.specs["Altura de trabajo"] !== profile.workHeight ||
    Object.keys(profile.specifications).some((key) => key in specs)) return specs;

  return { ...specs, ...profile.specifications };
};
