import { createHash } from "node:crypto";
import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";

type VerifiedElectricDrive = Readonly<{
  reference: string;
  brand: string;
  model: string;
  url: string;
  sourceHash: string;
}>;

const evidence: readonly VerifiedElectricDrive[] = [
  {
    "reference": "6077",
    "brand": "GENIE",
    "model": "Z-30/20N",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6077-2016-genie-z-3020n",
    "sourceHash": "dcab4cc0d45bbfa3c00457b40d5f965bd3f153375b27335dd780b5a5dc74d4bc"
  },
  {
    "reference": "6126",
    "brand": "GENIE",
    "model": "Z-30/20N",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6126-2016-genie-z-3020n",
    "sourceHash": "e98e881321ef06c01e0bd32066478186ee1ca2d42ae005c97cc920a0bd46f7f0"
  },
  {
    "reference": "6202",
    "brand": "GENIE",
    "model": "Z-30/20N",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6202-2016-genie-z-3020n",
    "sourceHash": "b3a6b083ffa057500a7ea5ad6f4860580c26cdaf84e0253bffb7d519d6e4a92e"
  },
  {
    "reference": "6228",
    "brand": "GENIE",
    "model": "Z-30/20N",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6228-2016-genie-z-3020n-",
    "sourceHash": "0d6932a1878d60ce63a8e6da86f8ed50f36a36741796665091345ad359e829a3"
  },
  {
    "reference": "6206",
    "brand": "MANITOU",
    "model": "170AETJL-BI",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6206-jd-00340",
    "sourceHash": "099eb94940f6e5460a0ef37c7f3e27738c2da7ada1339fc9d815b41f2cf5bd4a"
  },
  {
    "reference": "6937",
    "brand": "HAULOTTE",
    "model": "OPTIMUM 8",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6937-2007-haulotte-optimum-8",
    "sourceHash": "90e0ff39675a544f7c1403c935f79eb98dd1b7b78e78ac6d5e9f2726dee3b086"
  },
  {
    "reference": "6854",
    "brand": "SNORKEL",
    "model": "S3219E",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6854-2018-snorkel-s3219e",
    "sourceHash": "828e0b66ec01d6957ff3cb7ee1f6ff8c40493ad50bd290161f6e99bd05979ffc"
  },
  {
    "reference": "6362",
    "brand": "GENIE",
    "model": "GS-2632",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6362-2016-genie-gs-2632",
    "sourceHash": "ef08ccd351d4855407d8600cf3e6474f5100983b44e33636439804f36355403a"
  },
  {
    "reference": "6878",
    "brand": "LINDE",
    "model": "E16C",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6878-2019-linde-e16c",
    "sourceHash": "3170e1dbf4160aeeb032083c7cab54cc18d3c20439a9d538cbab75e66426d374"
  },
  {
    "reference": "6706",
    "brand": "YALE",
    "model": "ERP 16 VF LWB",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6706-2019-yale-erp-16-vf-lwb",
    "sourceHash": "8e82d376c47350318bf9808fa999246f5c0848bf652f34d6fd4f154462a2c094"
  },
  {
    "reference": "5880",
    "brand": "CESAB",
    "model": "B418",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/5880-2016-cesab-b418-",
    "sourceHash": "e0767fe18dd2d5e969679fa3dec6e8d6a129ecf1ec5e9d6b04f1f88c36823302"
  },
  {
    "reference": "6819",
    "brand": "CESAB",
    "model": "B318LII",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6819-2023-cesab-b318lii",
    "sourceHash": "810a59f029eeb4fe0e79a328c18bbf3277100dce487ca300fa938ed0c101a7fa"
  },
  {
    "reference": "6820",
    "brand": "CESAB",
    "model": "B318LII",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6820-2024-cesab-b318lii",
    "sourceHash": "893ff8d1189e9f2c46ddca282e0390a8042834de545618002fbebadbedc6d484"
  },
  {
    "reference": "6823",
    "brand": "CESAB",
    "model": "B318LII",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6823-2024-cesab-b318lii",
    "sourceHash": "4984d1d7c9623e459d5cd34b638a2250fef863599cc1cc595f7100cd3cada3f6"
  },
  {
    "reference": "6841",
    "brand": "YALE",
    "model": "ERP18VTMWB",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6841-2018-yale-erp18vt-mwb",
    "sourceHash": "74bcf7460c0798dd589499f606da73acc249d39953ad8f0518ebbcb767009627"
  },
  {
    "reference": "5910",
    "brand": "HYSTER",
    "model": "J1.8XNT MWB",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/5910-2019-hyster-j18xnt-mwb",
    "sourceHash": "9d59fe3a51674c1eed670bac44c3701974947ba2312b73dcd4b63db1cb3d528d"
  },
  {
    "reference": "6146",
    "brand": "UNICARRIERS",
    "model": "A1N1L18Q",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6146-2015-unicarriers-a1n1l18q",
    "sourceHash": "30e966d4078516b42f8b76106aa7cb20cba042287f06558f8a7ab3e79e481e01"
  },
  {
    "reference": "6738",
    "brand": "UNICARRIERS",
    "model": "A1N1L18Q",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6738-2016-unicarriers-a1n1l18q-",
    "sourceHash": "667c1812d5487dfcdd4bf2b0ae8a9ab8a73026132aa17c80062ef99015e13d8f"
  },
  {
    "reference": "6860",
    "brand": "STILL",
    "model": "RX 60-35",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6860-2015-still-rx-60-35",
    "sourceHash": "47f17f6374d1b3a5036ccf86875106aad2523c6f86acf2851a05d5b8a3c820c1"
  },
  {
    "reference": "6835",
    "brand": "YALE",
    "model": "ERP35VL",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6835-2019-yale-erp35vl",
    "sourceHash": "b6bda6e3bbea7fc19c58dba80906513aca80a4bf9aa1e94e2cd237fee4b39f36"
  },
  {
    "reference": "6858",
    "brand": "YALE",
    "model": "ERP35VL",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6858-2019-yale-erp35vl",
    "sourceHash": "18f9b8f374d70e65e11d98172c592518cc12c821ae97d45f27bf9621e0580cc1"
  },
  {
    "reference": "6932",
    "brand": "YALE",
    "model": "MP16",
    "url": "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/6932-2021-yale-mp16",
    "sourceHash": "9929388097f4a5efde619a01f6489319455d81214585cc8aa5798c1423e4282a"
  },
  {
    "reference": "6922",
    "brand": "HYSTER",
    "model": "P1.6",
    "url": "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/6922-2021-hyster-p16",
    "sourceHash": "e95bf5c41fd87e25ad9bc468bd304706807175008935deedb6cc5ab2a77069d0"
  },
  {
    "reference": "5739",
    "brand": "HYSTER",
    "model": "P1.6",
    "url": "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/5739-2022-hyster-p16",
    "sourceHash": "d937a8df19b208e99f5e3a13592edfff1210c0c1341be33c4ed33a47362256df"
  },
  {
    "reference": "6650",
    "brand": "JLG",
    "model": "E300AJP",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6650-2006-jlg-e300ajp",
    "sourceHash": "6cd10eb783cf7968e0a328db030e339e372cd99744fe0b3c55cec666f6c98125"
  },
  {
    "reference": "5730",
    "brand": "JLG",
    "model": "E300AJP",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/5730-2007-jlg-e300ajp",
    "sourceHash": "a0d21b3292eda60a198a0ad2644c975f0173c8ce6b99631f9722d1697bbb5607"
  },
  {
    "reference": "6998",
    "brand": "JLG",
    "model": "E300AJP",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6998-2007-jlg-e300ajp",
    "sourceHash": "87016851b0b67a8a3803cf77caab837826a1a60ac40f86cc58707ef61e076fe8"
  },
  {
    "reference": "6669",
    "brand": "BERG HORTICULTURA",
    "model": "STAR 300",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6669-2023-berg-horticultura-star-300",
    "sourceHash": "2c78dc06b95b0afd65a4aa6cb0351db24caef60de11074ab4a7475c39d771fcb"
  },
  {
    "reference": "6652",
    "brand": "HYSTER",
    "model": "P2.0SD",
    "url": "https://online.gamrentals.com/es/apiladoras-elevadoras-electricas-segunda-mano/6652-2021-hyster-p20sd",
    "sourceHash": "f1b725fc225362a6e186778a07d3d52b8d4d9c15ad9526e11480b0ac165bd3a8"
  },
  {
    "reference": "5937",
    "brand": "HYSTER",
    "model": "P2.0SD",
    "url": "https://online.gamrentals.com/es/apiladoras-elevadoras-electricas-segunda-mano/5937-2021-hyster-p20sd",
    "sourceHash": "1a556f87fd086434eb9edf7ccd62b8b4f831f982f5dc58b0b2a5ab85d44a50c6"
  },
  {
    "reference": "6754",
    "brand": "HYSTER",
    "model": "LO2.5",
    "url": "https://online.gamrentals.com/es/preparapedidos-segunda-mano/6754-2021-hyster-lo25",
    "sourceHash": "d9381746bdd35c1b9cd4e9f2755aa7b4e96675f61a196f24101f801399b53685"
  },
  {
    "reference": "6585",
    "brand": "HYSTER",
    "model": "J2.0XNT MWB",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6585-2021-hyster-j20xnt-mwb-",
    "sourceHash": "7178c31b3268f649b08386d47896e965b1e62acfff3252a2fd7776d139c1f96f"
  },
  {
    "reference": "6631",
    "brand": "MANITOU",
    "model": "150 AETJC",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6631-2008-manitou-150-aetj-c",
    "sourceHash": "0b65c1fd314f0c8eb4aee5e25e9427ec3eaadc462a87f2e09e5f43b34a7d673b"
  },
  {
    "reference": "6967",
    "brand": "HAULOTTE",
    "model": "OPTIMUM 8",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6967-2007-haulotte-optimum-8",
    "sourceHash": "617b2255d31a842960bd535347e4b34b681da8bfd924e30d771c5d2605624036"
  },
  {
    "reference": "6778",
    "brand": "SNORKEL",
    "model": "S3219E",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6778-2017-snorkel-s3219e",
    "sourceHash": "9d1f57d77674f6f0d78415482511215618278d4d703768243f04f7fbae6fc4a7"
  },
  {
    "reference": "6845",
    "brand": "HAULOTTE",
    "model": "COMPACT 8",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6845-2012-haulotte-compact-8",
    "sourceHash": "79d1df5f25f648e299b71c61a458ee390131196a025718bfe4eb275b3767f986"
  },
  {
    "reference": "6130",
    "brand": "HAULOTTE",
    "model": "COMPACT 8",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6130-2011-haulotte-compact-8",
    "sourceHash": "8bafec4172f640919b07227c041fff0beca4bcfd590735f7a9d4150f0f61d199"
  },
  {
    "reference": "6284",
    "brand": "GENIE",
    "model": "GS-2632",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6284-2016-genie-gs-2632",
    "sourceHash": "5f045b886563d080ea54a4a0a2dda1141c3579ae49878802d9752191f89f9829"
  },
  {
    "reference": "6063",
    "brand": "HAULOTTE",
    "model": "COMPACT 12",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6063-2013-haulotte-compact-12",
    "sourceHash": "7e63481efaa8691c1d7d83236b0cb0cbbba72723a36f5daa5f020dbfe81daba3"
  },
  {
    "reference": "6064",
    "brand": "HAULOTTE",
    "model": "COMPACT 12",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6064-2013-haulotte-compact-12",
    "sourceHash": "08fca567218f9e2d2567d9b077ea0f4584f1da2fa306912faf0e556a582b7010"
  },
  {
    "reference": "6065",
    "brand": "HAULOTTE",
    "model": "COMPACT 12",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6065-2013-haulotte-compact-12",
    "sourceHash": "2c96616ab236dad01b43c0132f09846e47b1c0ec7ff1d494be2b56dcd5d45d18"
  },
  {
    "reference": "6109",
    "brand": "HAULOTTE",
    "model": "COMPACT 12",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6109-2013-haulotte-compact-12",
    "sourceHash": "6ad06d62a658212e4a1e905ac6721674536b3fb3db29791c5b8b58ef8f235262"
  },
  {
    "reference": "6204",
    "brand": "HAULOTTE",
    "model": "COMPACT 12",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6204-2013-haulotte-compact-12",
    "sourceHash": "8e68628a9e8b4b7b97b14b759f0f9d4b21226ef4202a2855c63186ec01b3e78e"
  },
  {
    "reference": "6389",
    "brand": "GENIE",
    "model": "GS-3246",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6389-2015-genie-gs-3246",
    "sourceHash": "6ec8154c15e4ad28f942742603d587018995c78655aaef16e482025a3f78e941"
  },
  {
    "reference": "6849",
    "brand": "YALE",
    "model": "ERP16VT MWB",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6849-2017-yale-erp16vt-mwb",
    "sourceHash": "54b0e97f01cf8b2aecd60fdfc592d7677c6718e844244866bfb507edeca6702c"
  },
  {
    "reference": "6821",
    "brand": "CESAB",
    "model": "B318LII",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6821-2024-cesab-b318lii",
    "sourceHash": "e898c594f7d0ebffeb59f5b7c4a5b23fb90ad30b6a9296e9b7a9fa0e98381f76"
  },
  {
    "reference": "6822",
    "brand": "CESAB",
    "model": "B318LII",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6822-2024-cesab-b318lii",
    "sourceHash": "e61fdc14249bc03944ade157d3aa634931ff6d0447bf6fe1545b923a42143fbb"
  },
  {
    "reference": "6816",
    "brand": "CESAB",
    "model": "B318LII",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6816-2023-cesab-b318lii",
    "sourceHash": "3be850a0648be23a948bb3e24a8eecc7b48c8a58ed88c1f3702b20b1d46612fb"
  },
  {
    "reference": "6817",
    "brand": "CESAB",
    "model": "B318LII",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6817-2023-cesab-b318lii",
    "sourceHash": "1b5764896a9f91afb83718c06f09c2e82946b63d680e7e5ee5f04dad802106ab"
  },
  {
    "reference": "6837",
    "brand": "YALE",
    "model": "ERP25VL",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6837-2015-yale-erp25vl",
    "sourceHash": "4f35c9048de96ad9481b31472071ad488ec2de53d30496aee72e156d8ddf4325"
  },
  {
    "reference": "6510",
    "brand": "CARER",
    "model": "R150VLK96V",
    "url": "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6510-1999-carer-r150vlk96v",
    "sourceHash": "a929f1bc3b4839d58df4d9a0a51cbfeb1f84f6562dfb364d15c7cd837e39c66f"
  },
  {
    "reference": "6949",
    "brand": "HYSTER",
    "model": "P1.6",
    "url": "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/6949-2018-hyster-p16",
    "sourceHash": "05e018a3e1cbd30f231e8fac008a62b8a202b95a9228a49150ffeab2e14e28a9"
  },
  {
    "reference": "5719",
    "brand": "HYSTER",
    "model": "P2.0S",
    "url": "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/5719-2018-hyster-p20s",
    "sourceHash": "d74b06430ff3f883903675127192c8fd5a0d5b34f1aec255b8d09a0fca50a8d9"
  },
  {
    "reference": "6664",
    "brand": "HYSTER",
    "model": "P2.0S FBW",
    "url": "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/6664-2020-hyster-p20s-fbw",
    "sourceHash": "d490bc2a6b4a61fdc19fd327db427eaa4a54a8b5bd08edc537087df33ee4b01b"
  },
  {
    "reference": "6675",
    "brand": "HYSTER",
    "model": "P2.0S FBW",
    "url": "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/6675-2020-hyster-p20s-fbw",
    "sourceHash": "3d1f4d407a783aad6848e8e2a7ee5ec5053562f079007496628d8dbcb452652b"
  },
  {
    "reference": "5962",
    "brand": "HYSTER",
    "model": "P2.0S FBW",
    "url": "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/5962-2015-hyster-p20s-fbw",
    "sourceHash": "600d38d4ec152c09a2b0c1ca0a3c84960d40247a3e9f2801e1c5201a24d41908"
  },
  {
    "reference": "6663",
    "brand": "STILL",
    "model": "EXV 14 I",
    "url": "https://online.gamrentals.com/es/apiladoras-elevadoras-electricas-segunda-mano/6663-2018-still-exv-14-i",
    "sourceHash": "56a18437fb97fe5258217cf08f9f3e9651b36287808d288c5ecc4394435e0f82"
  },
  {
    "reference": "6788",
    "brand": "YALE",
    "model": "MS15XUX",
    "url": "https://online.gamrentals.com/es/apiladoras-elevadoras-electricas-segunda-mano/6788-2021-yale-ms15xux",
    "sourceHash": "4534794b751b97776cf5ee852a5d052f86afe98e5444fea7a7b816020f9cd8a5"
  },
  {
    "reference": "6196",
    "brand": "JLG",
    "model": "1930 ES",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6196-jp-00309",
    "sourceHash": "fb66ae3c16940f2964b0583628eb46d625f21fa8c375ef17f0a4a1b90a7825d9"
  },
  {
    "reference": "6195",
    "brand": "JLG",
    "model": "1930 ES",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6195-jp-00368",
    "sourceHash": "62e4f0b6a125cc2b04b15209a9aec5e76a29e57a21d6feef88025c07d8eeb0c9"
  },
  {
    "reference": "6486",
    "brand": "JLG",
    "model": "1930 ES",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6486-2006-jlg-1930es-",
    "sourceHash": "f07374d2c8e51a5ce84409fb56651ddae705bd3c0d9b2139814e2ffa6746b7b8"
  },
  {
    "reference": "6779",
    "brand": "SNORKEL",
    "model": "S3219E",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6779-2017-snorkel-s3219e",
    "sourceHash": "409383271ab96a72752d095800f67ce1d5524e4887fbb3e661d4c764ec4bd9f7"
  },
  {
    "reference": "6855",
    "brand": "SNORKEL",
    "model": "S3219E",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6855-2018-snorkel-s3219e",
    "sourceHash": "3027dee03d44fd78667a6c4d80ceaee754030a613286e148f49fba233cc81f44"
  },
  {
    "reference": "6856",
    "brand": "SNORKEL",
    "model": "S3219E",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6856-2018-snorkel-s3219e",
    "sourceHash": "d47115a048226e76ee250157791ae2133658e62146f8a298329b375290b4f387"
  },
  {
    "reference": "6859",
    "brand": "SNORKEL",
    "model": "S3219E",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6859-2017-snorkel-s3219e",
    "sourceHash": "1a6db0384e115c1a72f6c6ff176b4f0be716df21b86749cdbf3d2d50f2ef668c"
  },
  {
    "reference": "6864",
    "brand": "SNORKEL",
    "model": "S3219E",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6864-2018-snorkel-s3219e",
    "sourceHash": "1a8b4ddca83e5bbd44eac612f339e6a57877a80b3e606dfd2c9964405a44a682"
  },
  {
    "reference": "5979",
    "brand": "SNORKEL",
    "model": "S3219E",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/5979-2017-snorkel-s3219e",
    "sourceHash": "fdfebab63aa3fe99193d0c85b4396f6e01789071624340df9bd119dd50a72adb"
  },
  {
    "reference": "5845",
    "brand": "JLG",
    "model": "10RS",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/5845-2015-jlg-10rs",
    "sourceHash": "60f51217ff3abce4ac20976e7af94e50bcd40a37553d5c063fc6a3abf730abc7"
  },
  {
    "reference": "6982",
    "brand": "HAULOTTE",
    "model": "COMPACT 12",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6982-2010-haulotte-compact-12",
    "sourceHash": "dbbef5e70505d9903af9f100389149ef3b803b8b8a5b6f71c13b3de950373e4c"
  },
  {
    "reference": "6116",
    "brand": "SNORKEL",
    "model": "S4732E",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6116-2018-snorkel-s4732e",
    "sourceHash": "72019ca31c5da3ec7dca9d85609949a2b0ca9e192f67e367894b9aa3fd979bf1"
  },
  {
    "reference": "6980",
    "brand": "JLG",
    "model": "1930ES",
    "url": "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6980-2014-jlg-1930es",
    "sourceHash": "ee7fa2e046c5cbd21363a7553a1506e0b528fb2c8891b245b0c2e79f8ebc249e"
  },
  {
    "reference": "6545",
    "brand": "SAMAG",
    "model": "MICRON INOX",
    "url": "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/6545-a",
    "sourceHash": "111dca0c1b9efac3930bf0f0a92e54994c9d87d900bd1b1be190d16a9b8c2e1d"
  },
  {
    "reference": "5792",
    "brand": "TOYOTA",
    "model": "LPE200",
    "url": "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/5792-2006-toyota-lpe200-",
    "sourceHash": "32c5af73a6ac9656162dd66e6eeb9b834c7445250d0e02efe28a54984bed8c8b"
  },
  {
    "reference": "6122",
    "brand": "YALE",
    "model": "MP20T",
    "url": "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/6122-2016-yale-mp-20t",
    "sourceHash": "b342c6ab7abaca5d0b200f306ad66820a203061da3cccaecb3eb766a8233e7dd"
  },
  {
    "reference": "5848",
    "brand": "TOYOTA",
    "model": "LPE240/S",
    "url": "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/5848-2011-toyota-lpe240s",
    "sourceHash": "9a895986dd55b4602de3ce975828290c2d47c322e13fbbacd82b1509a88f25a9"
  },
  {
    "reference": "6691",
    "brand": "HYSTER",
    "model": "PC1.4",
    "url": "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/6691-2018-hyster-pc-14",
    "sourceHash": "c01fb2d9561dd6f7921723655367aeb510da00cee0be31af07e56831dc6cc927"
  },
  {
    "reference": "6084",
    "brand": "LOGITRANS",
    "model": "EHSI1000",
    "url": "https://online.gamrentals.com/es/apiladoras-elevadoras-electricas-segunda-mano/6084-2021-logitrans-ehsi1000",
    "sourceHash": "578c7f05132310e12d0fb2e644ba1a941479053383370e88506d76dea823bbb9"
  },
  {
    "reference": "6966",
    "brand": "TECNA",
    "model": "VTA25",
    "url": "https://online.gamrentals.com/es/tractores-electricos-segunda-mano/6966-2015-tecna-vta25",
    "sourceHash": "c103f88d26ed6d53c93911bb5fa790742224b54a8958647dbf0e0fc0ac75cab7"
  }
];

const byReference = new Map(evidence.map((item) => [item.reference, item]));

const sourceHash = (record: ProductRecord): string => createHash("sha256")
  .update(JSON.stringify([
    record.providerId, record.reference, record.url, record.brand, record.model,
    record.categoryKey, record.condition, record.title, record.shortDescription, record.longDescription
  ])).digest("hex");

export const recoverGamVerifiedElectricDriveSpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  const item = byReference.get(record.reference ?? "");
  if (!item || record.providerId !== "gam" || record.condition !== "Segunda mano" ||
    (record.categoryKey !== "elevacion" && record.categoryKey !== "manutencion") ||
    record.url !== item.url || record.brand !== item.brand || record.model !== item.model ||
    source["Marca"] !== item.brand || source["Modelo"] !== item.model ||
    Object.keys(source).some((key) => /motor|motoriz|propulsi[oó]n|combustible/iu.test(key)) ||
    sourceHash(record) !== item.sourceHash) return source;
  return { ...source, "Motorización": "Eléctrico" };
};
