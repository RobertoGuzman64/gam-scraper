import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";

type YearEvidence = Readonly<{
  reference: string;
  year: string;
  brand: string;
  model: string | null;
  category: string;
  title?: string;
  sourceBrand?: string;
  sourceModel?: string;
  condition?: ProductRecord["condition"];
  url: string;
}>;

const evidence: readonly YearEvidence[] = [
  { reference: "6997", year: "2007", brand: "SKYJACK", model: "SJ-6826 RT", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-diesel-segunda-mano/6997-2007-sky-jack-sj-6826-rt", category: "elevacion", title: "Plataforma tijera diésel 10M SKY JACK SJ-6826 RT" },
  { reference: "6196", year: "2015", brand: "JLG", model: "1930 ES", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6196-jp-00309", category: "elevacion", title: "Plataforma Tijera Eléctrica 8M JLG 1930ES" },
  { reference: "6195", year: "2016", brand: "JLG", model: "1930 ES", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6195-jp-00368", category: "elevacion", title: "Plataforma Tijera Eléctrica 8M JLG 1930ES" },
  { reference: "6857", year: "2006", brand: "JLG", model: "3512", url: "https://online.gamrentals.com/es/manipuladores-frontales-segunda-mano/6857-2006-jlg-3512", category: "manipulacion", title: "Manipulador telescópico 11M 3500Kg JLG 3512" },
  { reference: "6834", year: "2026", brand: "DEVOL", model: "VGR-30", url: "https://online.gamrentals.com/es/generadores-electricos-segunda-mano/6834-2026-devol-vgr-30", category: "energia", title: "Grupo electrógeno DEVOL VGR-30" },
  { reference: "6358", condition: null, year: "2019", brand: "KNOTT", model: "KRV20", url: "https://online.gamrentals.com/es/carro-de-equipaje/6358-2019-knott-krv20", category: "otros", title: "Carro de arrastre 2000Kg KNOTT KRV20" },
  { reference: "6367", condition: null, year: "2019", brand: "KNOTT", model: "KRV20", url: "https://online.gamrentals.com/es/carro-de-equipaje/6367-2019-knott-krv20", category: "otros", title: "Carro de arrastre 2000Kg KNOTT KRV20" },
  { reference: "6920", year: "2019", brand: "HYSTER", model: null, url: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6920-2019-hyster-h25ft", category: "manutencion", title: "Carretilla elevadora GLP 2500Kg Hyster H2.5FT", sourceModel: "H2.5FT" },
  { reference: "6881", year: "2016", brand: "DOOSAN", model: null, url: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-segunda-mano/6881-2016-doosan-d25g", category: "manutencion", title: "Carretilla elevadora diésel 2500Kg DOOSAN D25G", sourceModel: "D25G" },
  { reference: "6947", year: "2016", brand: "HAULOTTE", model: "HA20 RTJ", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-diesel-segunda-mano/6947-2016-haulotte-ha20-rtj", category: "elevacion", title: "PLATAFORMA ARTICULADA DIÉSEL 20M HAULOTE HA20 RTJ", sourceBrand: "HAULOTE" },
  { reference: "6607", year: "2012", brand: "GENIE", model: "Z45/25J", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-diesel-segunda-mano/6607-2012-genie-z45-25-j" },
  { reference: "6571", year: "2009", brand: "HAULOTTE", model: "HA32PX", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-diesel-segunda-mano/6571-2009-haulotte-ha32px-" },
  { reference: "6631", year: "2008", brand: "MANITOU", model: "150 AETJC", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6631-2008-manitou-150-aetj-c" },
  { reference: "6614", year: "2007", brand: "JLG", model: "4394RT", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-diesel-segunda-mano/6614-2007-jlg-4394rt" },
  { reference: "6886", year: "2023", brand: "MAGNI", model: "DS1523RTP", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-diesel-segunda-mano/6886-2023-magni-ds1523rtp" },
  { reference: "6051", year: "2012", brand: "HAULOTTE", model: "H18SX", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-diesel-segunda-mano/6051-2012-haulotte-h18sx" },
  { reference: "6486", year: "2006", brand: "JLG", model: "1930 ES", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6486-2006-jlg-1930es-" },
  { reference: "6845", year: "2012", brand: "HAULOTTE", model: "COMPACT 8", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6845-2012-haulotte-compact-8" },
  { reference: "6362", year: "2016", brand: "GENIE", model: "GS-2632", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6362-2016-genie-gs-2632" },
  { reference: "6116", year: "2018", brand: "SNORKEL", model: "S4732E", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6116-2018-snorkel-s4732e" },
  { reference: "6514", year: "2018", brand: "HYSTER", model: "H1.8FT", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6514-2018-hyster-h18ft" },
  { reference: "5227", year: "2020", brand: "HYSTER", model: "H2.5FT", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/5227-2020-hyster-h25ft" },
  { reference: "6884", year: "2019", brand: "HYSTER", model: "H2.5FT", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6884-2019-hyster-h25ft" },
  { reference: "5213", year: "2019", brand: "HYSTER", model: "H3.5FT", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/5213-2019-hyster-h35ft" },
  { reference: "6686", year: "2012", brand: "HYSTER", model: "H5.0FT", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6686-2012-hyster-h50ft" },
  { reference: "6684", year: "2011", brand: "HYSTER", model: "H5.0FT", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6684-2011-hyster-h50ft" },
  { reference: "5714", year: "2021", brand: "HYSTER", model: "H5.5FT", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/5714-2021-hyster-h55ft" },
  { reference: "6627", year: "2014", brand: "KARGO", model: "TH40W", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-segunda-mano/6627-2014-kargo-th40w" },
  { reference: "6618", year: "2006", brand: "MITSUBISHI", model: "FD45K2", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-segunda-mano/6618-2006-mitsubishi-fd45k2" },
  { reference: "5739", year: "2022", brand: "HYSTER", model: "P1.6", category: "manutencion", url: "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/5739-2022-hyster-p16" },
  { reference: "6616", year: "2007", brand: "JLG", model: "4394RT", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-diesel-segunda-mano/6616-2007-jlg-4394rt" },
  { reference: "6615", year: "2007", brand: "JLG", model: "4394RT", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-diesel-segunda-mano/6615-2007-jlg-4394rt" },
  { reference: "6974", year: "2026", brand: "MANITOU", model: "MI50D", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-segunda-mano/6974-2026-manitou-mi50d" },
  { reference: "6975", year: "2026", brand: "MANITOU", model: "MI50D", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-segunda-mano/6975-2026-manitou-mi50d" },
  { reference: "6130", year: "2011", brand: "HAULOTTE", model: "COMPACT 8", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6130-2011-haulotte-compact-8" },
  { reference: "6284", year: "2016", brand: "GENIE", model: "GS-2632", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6284-2016-genie-gs-2632" },
  { reference: "6389", year: "2015", brand: "GENIE", model: "GS-3246", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6389-2015-genie-gs-3246" },
  { reference: "6226", year: "2016", brand: "GENIE", model: "GS-3246", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6226-2016-genie-gs3246" },
  { reference: "6980", year: "2014", brand: "JLG", model: "1930ES", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6980-2014-jlg-1930es" },
  { reference: "6233", year: "2007", brand: "JLG", model: "860SJ", category: "elevacion", url: "https://online.gamrentals.com/es/elevadores-telescopicos-segunda-mano/6233-2007-jlg-860sj" },
  { reference: "6626", year: "2008", brand: "JLG", model: "860SJ", category: "elevacion", url: "https://online.gamrentals.com/es/elevadores-telescopicos-segunda-mano/6626-2008-jlg-860sj" },
  { reference: "6776", year: "2018", brand: "GENIE", model: "GR-20", category: "elevacion", url: "https://online.gamrentals.com/es/elevadores-unipersonales-segunda-mano/6776-2018-genie-gr-20" },
  { reference: "6492", year: "2015", brand: "HAULOTTE", model: "STAR 10", category: "elevacion", url: "https://online.gamrentals.com/es/elevadores-unipersonales-segunda-mano/6492-2015-haulotte-star-10-" },
  { reference: "5280", year: "2019", brand: "HYSTER", model: "H2.5FT", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/5280-2019-hyster-h25ft" },
  { reference: "6885", year: "2016", brand: "HYSTER", model: "H2.5FT", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6885-2016-hyster-h25ft" },
  { reference: "6950", year: "2021", brand: "HYSTER", model: "R1.6", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-retractiles-segunda-mano/6950-2021-hyster-r16" },
  { reference: "6436", year: "2022", brand: "HYSTER", model: "P2.0", category: "manutencion", url: "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/6436-2022-hyster-p20" },
  { reference: "5719", year: "2018", brand: "HYSTER", model: "P2.0S", category: "manutencion", url: "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/5719-2018-hyster-p20s" },
  { reference: "5962", year: "2015", brand: "HYSTER", model: "P2.0S FBW", category: "manutencion", url: "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/5962-2015-hyster-p20s-fbw" },
  { reference: "5228", year: "2022", brand: "LIFTER", model: "GS/I 25S4 RA", category: "manutencion", url: "https://online.gamrentals.com/es/transpaletas-elevadoras-manuales-segunda-mano/5228-2022-lifter-gsi-25s4-ra" },
  { reference: "6391", year: "2006", brand: "JLG", model: "4013", category: "manipulacion", url: "https://online.gamrentals.com/es/manipuladores-frontales-segunda-mano/6391-2006-jlg-4013" },
  { reference: "6901", year: "2018", brand: "SNORKEL", model: "A46JRT", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-diesel-segunda-mano/6901-2018-snorkel-a46jrt" },
  { reference: "6912", year: "2018", brand: "SNORKEL", model: "A46JRT", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-diesel-segunda-mano/6912-2018-snorkel-a46jrt" },
  { reference: "6139", year: "2013", brand: "JLG", model: "450AJ", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-diesel-segunda-mano/6139-2013-jlg-450aj" },
  { reference: "6846", year: "2006", brand: "JLG", model: "510AJ", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-diesel-segunda-mano/6846-2006-jlg-510aj" },
  { reference: "6979", year: "2017", brand: "MANITOU", model: "200 ATJ", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-diesel-segunda-mano/6979-2017-manitou-200-atj" },
  { reference: "6985", year: "2017", brand: "MANITOU", model: "200 ATJ", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-diesel-segunda-mano/6985-2017-manitou-200-atj" },
  { reference: "6752", year: "2007", brand: "JLG", model: "600AJ", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-diesel-segunda-mano/6752-2007-jlg-600aj" },
  { reference: "6311", year: "2012", brand: "HAULOTTE", model: "HA20PX", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-diesel-segunda-mano/6311-2012-haulotte-ha20px" },
  { reference: "6630", year: "2011", brand: "HAULOTTE", model: "HA20PX", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-diesel-segunda-mano/6630-2011-haulotte-ha20px" },
  { reference: "6632", year: "2012", brand: "HAULOTTE", model: "HA20PX", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-diesel-segunda-mano/6632-2012-haulotte-ha20px" },
  { reference: "6977", year: "2005", brand: "JLG", model: "800AJ", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-diesel-segunda-mano/6977-2005-jlg-800aj" },
  { reference: "6945", year: "2007", brand: "JLG", model: "800AJ", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-diesel-segunda-mano/6945-2007-jlg-800-aj" },
  { reference: "6941", year: "2019", brand: "HYSTER", model: "J1.5XNT SWB", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6941-2019-hyster-j15xnt-swb" },
  { reference: "6951", year: "2011", brand: "BT", model: "VCE150A", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6951-2011-bt-vce150a" },
  { reference: "5879", year: "2017", brand: "UNICARRIERS", model: "A2N1L16Q", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/5879-2017-unicarriers-a2n1l16q" },
  { reference: "6849", year: "2017", brand: "YALE", model: "ERP16VT MWB", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6849-2017-yale-erp16vt-mwb" },
  { reference: "6816", year: "2023", brand: "CESAB", model: "B318LII", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6816-2023-cesab-b318lii" },
  { reference: "6817", year: "2023", brand: "CESAB", model: "B318LII", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6817-2023-cesab-b318lii" },
  { reference: "6837", year: "2015", brand: "YALE", model: "ERP25VL", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6837-2015-yale-erp25vl" },
  { reference: "6880", year: "2022", brand: "MANITOU", model: "MI 35 DX ST5", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-segunda-mano/6880-2022-manitou-mi-35-dx-st5" },
  { reference: "6587", year: "2008", brand: "BT", model: "C4E500V", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-segunda-mano/6587-2008-bt-c4e500v" },
  { reference: "6510", year: "1999", brand: "CARER", model: "R150VLK96V", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6510-1999-carer-r150vlk96v" },
  { reference: "6915", year: "2009", brand: "MORA", model: "M160C", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-segunda-mano/6915-2009-mora-m160c" },
  { reference: "6878", year: "2019", brand: "LINDE", model: "E16C", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6878-2019-linde-e16c" },
  { reference: "6984", year: "2018", brand: "GENIE", model: "Z45/25J", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-diesel-segunda-mano/6984-2018-genie-z45-25j" },
  { reference: "6879", year: "2007", brand: "GENIE", model: "Z60/34", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-diesel-segunda-mano/6879-2007-genie-z-60-34" },
  { reference: "6572", year: "2006", brand: "HAULOTTE", model: "HA260PX", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-diesel-segunda-mano/6572-2006-haulotte-ha260px" },
  { reference: "6077", year: "2016", brand: "GENIE", model: "Z-30/20N", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6077-2016-genie-z-3020n" },
  { reference: "6126", year: "2016", brand: "GENIE", model: "Z-30/20N", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6126-2016-genie-z-3020n" },
  { reference: "6202", year: "2016", brand: "GENIE", model: "Z-30/20N", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6202-2016-genie-z-3020n" },
  { reference: "6998", year: "2007", brand: "JLG", model: "E300AJP", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6998-2007-jlg-e300ajp" },
  { reference: "6972", year: "2007", brand: "HAULOTTE", model: "H12SX", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-diesel-segunda-mano/6972-2007-haulotte-h12sx" },
  { reference: "6983", year: "2007", brand: "JLG", model: "3394 RT", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-diesel-segunda-mano/6983-2007-jlg-3394-rt" },
  { reference: "6483", year: "2007", brand: "HAULOTTE", model: "H15SX", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-diesel-segunda-mano/6483-2007-haulotte-h15sx" },
  { reference: "6937", year: "2007", brand: "HAULOTTE", model: "OPTIMUM 8", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6937-2007-haulotte-optimum-8" },
  { reference: "6854", year: "2018", brand: "SNORKEL", model: "S3219E", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6854-2018-snorkel-s3219e" },
  { reference: "5845", year: "2015", brand: "JLG", model: "10RS", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/5845-2015-jlg-10rs" },
  { reference: "6755", year: "2019", brand: "TOYOTA", model: "02 – 8FGF25", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6755-2019-toyota-02-8fgf25" },
  { reference: "5880", year: "2016", brand: "CESAB", model: "B418", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/5880-2016-cesab-b418-" },
  { reference: "6819", year: "2023", brand: "CESAB", model: "B318LII", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6819-2023-cesab-b318lii" },
  { reference: "6820", year: "2024", brand: "CESAB", model: "B318LII", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6820-2024-cesab-b318lii" },
  { reference: "6823", year: "2024", brand: "CESAB", model: "B318LII", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6823-2024-cesab-b318lii" },
  { reference: "6841", year: "2018", brand: "YALE", model: "ERP18VTMWB", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6841-2018-yale-erp18vt-mwb" },
  { reference: "6738", year: "2016", brand: "UNICARRIERS", model: "A1N1L18Q", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6738-2016-unicarriers-a1n1l18q-" },
  { reference: "6860", year: "2015", brand: "STILL", model: "RX 60-35", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6860-2015-still-rx-60-35" },
  { reference: "6835", year: "2019", brand: "YALE", model: "ERP35VL", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6835-2019-yale-erp35vl" },
  { reference: "6976", year: "2026", brand: "MANITOU", model: "MI50D", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-segunda-mano/6976-2026-manitou-mi50d" },
  { reference: "6726", year: "2011", brand: "KALMAR", model: "DCE120-6", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-segunda-mano/6726-2011-kalmar-dce120-6" },
  { reference: "6949", year: "2018", brand: "HYSTER", model: "P1.6", category: "manutencion", url: "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/6949-2018-hyster-p16" },
  { reference: "6228", year: "2016", brand: "GENIE", model: "Z-30/20N", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-articuladas-electricas-segunda-mano/6228-2016-genie-z-3020n-" },
  { reference: "6967", year: "2007", brand: "HAULOTTE", model: "OPTIMUM 8", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6967-2007-haulotte-optimum-8" },
  { reference: "6778", year: "2017", brand: "SNORKEL", model: "S3219E", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6778-2017-snorkel-s3219e" },
  { reference: "6779", year: "2017", brand: "SNORKEL", model: "S3219E", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6779-2017-snorkel-s3219e" },
  { reference: "6855", year: "2018", brand: "SNORKEL", model: "S3219E", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6855-2018-snorkel-s3219e" },
  { reference: "6856", year: "2018", brand: "SNORKEL", model: "S3219E", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6856-2018-snorkel-s3219e" },
  { reference: "6859", year: "2017", brand: "SNORKEL", model: "S3219E", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6859-2017-snorkel-s3219e" },
  { reference: "6864", year: "2018", brand: "SNORKEL", model: "S3219E", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6864-2018-snorkel-s3219e" },
  { reference: "5979", year: "2017", brand: "SNORKEL", model: "S3219E", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/5979-2017-snorkel-s3219e" },
  { reference: "6063", year: "2013", brand: "HAULOTTE", model: "COMPACT 12", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6063-2013-haulotte-compact-12" },
  { reference: "6064", year: "2013", brand: "HAULOTTE", model: "COMPACT 12", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6064-2013-haulotte-compact-12" },
  { reference: "6065", year: "2013", brand: "HAULOTTE", model: "COMPACT 12", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6065-2013-haulotte-compact-12" },
  { reference: "6109", year: "2013", brand: "HAULOTTE", model: "COMPACT 12", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6109-2013-haulotte-compact-12" },
  { reference: "6204", year: "2013", brand: "HAULOTTE", model: "COMPACT 12", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6204-2013-haulotte-compact-12" },
  { reference: "6821", year: "2024", brand: "CESAB", model: "B318LII", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6821-2024-cesab-b318lii" },
  { reference: "6822", year: "2024", brand: "CESAB", model: "B318LII", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6822-2024-cesab-b318lii" },
  { reference: "6858", year: "2019", brand: "YALE", model: "ERP35VL", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas-segunda-mano/6858-2019-yale-erp35vl" },
  { reference: "6372", year: "2008", brand: "KALMAR", model: "DCD200-12LB", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-segunda-mano/6372-2008-kalmar-dcd200-12lb-" },
  { reference: "6084", year: "2021", brand: "LOGITRANS", model: "EHSI1000", category: "manutencion", url: "https://online.gamrentals.com/es/apiladoras-elevadoras-electricas-segunda-mano/6084-2021-logitrans-ehsi1000" },
  { reference: "6788", year: "2021", brand: "YALE", model: "MS15XUX", category: "manutencion", url: "https://online.gamrentals.com/es/apiladoras-elevadoras-electricas-segunda-mano/6788-2021-yale-ms15xux" },
  { reference: "6582", year: "2014", brand: "YALE", model: "MO10E AC", category: "manutencion", url: "https://online.gamrentals.com/es/preparapedidos-segunda-mano/6582-2014-yale-mo10e-ac-" },
  { reference: "6601", year: "2017", brand: "YALE", model: "MO10E AC", category: "manutencion", url: "https://online.gamrentals.com/es/preparapedidos-segunda-mano/6601-2017-yale-mo10e-ac" },
  { reference: "6625", year: "2014", brand: "GENIE", model: "GS-5390", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-diesel-segunda-mano/6625-2014-genie-gs-5390" },
  { reference: "6982", year: "2010", brand: "HAULOTTE", model: "COMPACT 12", category: "elevacion", url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6982-2010-haulotte-compact-12" },
  { reference: "6932", year: "2021", brand: "YALE", model: "MP16", category: "manutencion", url: "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/6932-2021-yale-mp16" },
  { reference: "6723", year: "2019", brand: "TOYOTA", model: "LWE180", category: "manutencion", url: "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/6723-2019-toyota-lwe180-" },
  { reference: "6123", year: "2022", brand: "LOGITRANS", model: "EHLIP 1004", category: "manutencion", url: "https://online.gamrentals.com/es/transpaletas-elevadoras-manuales-segunda-mano/6123-2022-logitrans-ehlip-1004" },
  { reference: "6966", year: "2015", brand: "TECNA", model: "VTA25", category: "manutencion", url: "https://online.gamrentals.com/es/tractores-electricos-segunda-mano/6966-2015-tecna-vta25" },
  { reference: "6599", year: "2016", brand: "JCB", model: "85Z-1", category: "manipulacion", url: "https://online.gamrentals.com/es/mini-cargadoras-segunda-mano/6599-2016-jcb-85z-1-" },
  { reference: "6559", year: "2026", brand: "CRAWLER", model: "TP-500", category: "otros", url: "https://online.gamrentals.com/es/dumpers-segunda-mano/6559-2026-crawler-tp-500" },
  { reference: "6560", year: "2026", brand: "CRAWLER", model: "TP-500", category: "otros", url: "https://online.gamrentals.com/es/dumpers-segunda-mano/6560-2026-crawler-tp-500" },
  { reference: "6608", year: "2016", brand: "AMMANN", model: "ARW 65", category: "otros", url: "https://online.gamrentals.com/es/rodillo-tandem-segunda-mano/6608-2016-ammann-arw-65" },
  { reference: "6606", year: "2013", brand: "AMMANN", model: "ARW 65", category: "otros", url: "https://online.gamrentals.com/es/rodillo-tandem-segunda-mano/6606-2013-ammann-arw-65" },
  { reference: "6775", year: "2025", brand: "PLUS POWER", model: "T800HD-7", category: "otros", url: "https://online.gamrentals.com/es/rodillo-tandem-segunda-mano/6775-2025-plus-power-t800hd-7" },
  { reference: "6024", year: "2017", brand: "JUNGHEINRICH", model: "DFG320S", category: "manutencion", url: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-segunda-mano/6024-2017-jungheinrich-dfg320s" },
  { reference: "5792", year: "2006", brand: "TOYOTA", model: "LPE200", category: "manutencion", url: "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/5792-2006-toyota-lpe200-" },
  { reference: "6122", year: "2016", brand: "YALE", model: "MP20T", category: "manutencion", url: "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/6122-2016-yale-mp-20t" },
  { reference: "5848", year: "2011", brand: "TOYOTA", model: "LPE240/S", category: "manutencion", url: "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/5848-2011-toyota-lpe240s" },
];

const byReference = new Map(evidence.map((item) => [item.reference, item]));

const normalizedIdentity = (text: string): string => text.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").replace(/[^a-z0-9]/gu, "");

const recordedYears = (text: string): readonly string[] =>
  [...text.matchAll(/\b(?:fabricad[ao]s? en(?: el año)?|año de fabricaci[oó]n(?: de|:)?|fabricaci[oó]n (?:en|de)|modelo del a[nñ]o)\s*((?:19|20)\d{2})\b/giu)]
    .map((match) => match[1] ?? "");

export const recoverGamVerifiedUsedYearSpec = (record: ProductRecord): SpecsMap => {
  const source = record.specs ?? {};
  const item = byReference.get(record.reference ?? "");
  if (!item || record.providerId !== "gam" || record.condition !== (item.condition === undefined ? "Segunda mano" : item.condition) ||
    record.year !== item.year || record.brand !== item.brand || record.model !== item.model ||
    record.categoryKey !== item.category || record.url !== item.url ||
    (record.yearSource !== "url" && record.yearSource !== "descripcion") ||
    Object.keys(source).some((key) => /^(?:año|año de fabricación)$/iu.test(key))) return source;

  const longDescription = normalizedIdentity(record.longDescription ?? "");
  const title = normalizedIdentity(record.title ?? "");
  const brandInText = normalizedIdentity(item.sourceBrand ?? item.brand);
  const modelInText = normalizedIdentity(item.sourceModel ?? item.model ?? "");
  if (!modelInText || (item.title !== undefined && record.title !== item.title) ||
    !title.includes(brandInText) || (item.title !== undefined && !title.includes(modelInText)) ||
    !longDescription.includes(brandInText) || !longDescription.includes(modelInText)) return source;

  const years = recordedYears(record.longDescription ?? "");
  if (!years.length || years.some((year) => year !== item.year)) return source;
  if (record.specs?.["Marca"] !== undefined && record.specs["Marca"] !== item.brand) return source;
  if (record.specs?.["Modelo"] !== undefined && record.specs["Modelo"] !== item.model) return source;
  return { ...source, "Año de fabricación": item.year };
};
