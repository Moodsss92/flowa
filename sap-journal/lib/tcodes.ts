/**
 * Dictionnaire local T-code → [chemin, titre].
 * Sert à l'auto-complétion du formulaire et de référence pour Claude (/api/analyze).
 * Les chemins sont des propositions : toujours vérifier dans le système.
 */
export type TcodeEntry = readonly [chemin: string, titre: string];

const S = "SPRO";
const ES_DEF = `${S} › Enterprise Structure › Definition`;
const ES_ASG = `${S} › Enterprise Structure › Assignment`;
const FI_GS = `${S} › Financial Accounting › Financial Accounting Global Settings`;
const TAX = `${FI_GS} › Tax on Sales/Purchases`;
const SD = `${S} › Sales and Distribution`;
const LOG = "SAP Menu › Logistics";
const MM = `${LOG} › Materials Management`;
const PP = `${LOG} › Production`;
const SDM = `${LOG} › Sales and Distribution`;
const LE = `${LOG} › Logistics Execution › Outbound Process › Goods Issue for Outbound Delivery › Outbound Delivery › Create`;
const PCA = "SAP Menu › Accounting › Controlling › Profit Center Accounting › Master Data › Profit Center › Individual Processing";

export const TCODES: Record<string, TcodeEntry> = {
  // ---------- FI ----------
  EC01: [`${ES_DEF} › Financial Accounting › Edit, Copy, Delete, Check Company Code`, "Copier le company code"],
  OX02: [`${ES_DEF} › Financial Accounting › Edit, Copy, Delete, Check Company Code › Edit Company Code Data`, "Compléter les données du company code"],
  OBY6: [`${FI_GS} › Global Parameters for Company Code › Enter Global Parameters`, "Paramètres globaux du company code"],
  OB52: [`${FI_GS} › Ledgers › Fiscal Year and Posting Periods › Posting Periods › Open and Close Posting Periods`, "Ouvrir les périodes comptables"],
  FBN1: [`${FI_GS} › Document › Document Number Ranges › Documents in Entry View › Define Document Number Ranges for Entry View`, "Plages de numéros des pièces comptables"],
  OBBG: [`${TAX} › Basic Settings › Assign Country to Calculation Procedure`, "Affecter la procédure fiscale au pays"],
  FTXP: [`${TAX} › Calculation › Define Tax Codes for Sales and Purchases`, "Définir les codes TVA"],
  OB40: [`${TAX} › Posting › Define Tax Accounts`, "Définir les comptes de TVA"],
  OBCL: [`${TAX} › Posting › Allocate Tax Codes for Non-Taxable Transactions`, "Codes TVA des opérations non taxables"],
  OX19: [`${ES_ASG} › Controlling › Assign Company Code to Controlling Area`, "Affecter le company code au controlling area"],
  KE51: [`${PCA} › Create`, "Créer un centre de profit"],
  KE53: [`${PCA} › Display`, "Afficher un centre de profit"],

  // ---------- Structure organisationnelle ----------
  EC02: [`${ES_DEF} › Logistics - General › Define, Copy, Delete, Check Plant › Copy, Delete, Check Plant`, "Copier le plant"],
  OX10: [`${ES_DEF} › Logistics - General › Define, Copy, Delete, Check Plant › Define Plant`, "Définir le plant"],
  OX18: [`${ES_ASG} › Logistics - General › Assign Plant to Company Code`, "Affecter le plant au company code"],
  OX09: [`${ES_DEF} › Materials Management › Maintain Storage Location`, "Créer les storage locations"],
  OX08: [`${ES_DEF} › Materials Management › Maintain Purchasing Organization`, "Créer la purchasing organization"],
  OX01: [`${ES_ASG} › Materials Management › Assign Purchasing Organization to Company Code`, "Affecter la purchasing org au company code"],
  OX17: [`${ES_ASG} › Materials Management › Assign Purchasing Organization to Plant`, "Affecter la purchasing org au plant"],
  OVX5: [`${ES_DEF} › Sales and Distribution › Define, Copy, Delete, Check Sales Organization`, "Créer la sales organization"],
  OVXI: [`${ES_DEF} › Sales and Distribution › Define, Copy, Delete, Check Distribution Channel`, "Définir le canal de distribution"],
  OVXB: [`${ES_DEF} › Logistics - General › Define, Copy, Delete, Check Division`, "Définir la division"],
  OVX3: [`${ES_ASG} › Sales and Distribution › Assign Sales Organization to Company Code`, "Affecter la sales org au company code"],
  OVXK: [`${ES_ASG} › Sales and Distribution › Assign Distribution Channel to Sales Organization`, "Affecter le canal à la sales org"],
  OVXA: [`${ES_ASG} › Sales and Distribution › Assign Division to Sales Organization`, "Affecter la division à la sales org"],
  OVXG: [`${ES_ASG} › Sales and Distribution › Set up Sales Area`, "Créer la sales area"],
  OVX6: [`${ES_ASG} › Sales and Distribution › Assign Sales Organization - Distribution Channel - Plant`, "Affecter sales org / canal au plant"],
  OVXC: [`${ES_DEF} › Logistics Execution › Define, Copy, Delete, Check Shipping Point`, "Créer le shipping point"],
  OVXD: [`${ES_ASG} › Logistics Execution › Assign Shipping Point to Plant`, "Affecter le shipping point au plant"],

  // ---------- Données de base et flux ----------
  BP: ["SAP Menu › Cross-Application Components › SAP Business Partner › Business Partner › Maintain Business Partner", "Créer le business partner"],
  MM01: [`${MM} › Material Master › Material › Create (General) › Immediately`, "Créer le material master"],
  CS01: [`${PP} › Master Data › Bills of Material › Bill of Material › Material BOM › Create`, "Créer la nomenclature (BOM)"],
  C223: [`${PP} › Master Data › Production Versions`, "Créer la version de production"],
  ME11: [`${MM} › Purchasing › Master Data › Info Record › Create`, "Créer l'info record d'achat"],
  ME01: [`${MM} › Purchasing › Master Data › Source List › Maintain`, "Gérer la source list"],
  ME31K: [`${MM} › Purchasing › Outline Agreement › Contract › Create`, "Créer le contrat d'achat"],
  ME31L: [`${MM} › Purchasing › Outline Agreement › Scheduling Agreement › Create`, "Créer l'accord de livraison (scheduling agreement)"],
  ME21N: [`${MM} › Purchasing › Purchase Order › Create › Vendor/Supplying Plant Known`, "Créer la commande d'achat"],
  MIGO: [`${MM} › Inventory Management › Goods Movement › Goods Movement (MIGO)`, "Saisir l'entrée / la sortie de marchandises"],
  MIRO: [`${MM} › Logistics Invoice Verification › Document Entry › Enter Invoice`, "Saisir la facture fournisseur"],
  MD61: [`${PP} › Production Planning › Demand Management › Planned Independent Requirements › Create`, "Créer les besoins indépendants (PIR)"],
  MD02: [`${PP} › MRP › Planning › Single-Item, Multi-Level`, "Lancer le MRP (mono-article, multi-niveaux)"],
  MD04: [`${PP} › MRP › Evaluations › Stock/Requirements List`, "Liste stock / besoins"],
  CO40: [`${PP} › Shop Floor Control › Order › Create › From Planned Order`, "Convertir l'ordre planifié en ordre de fabrication"],
  CO02: [`${PP} › Shop Floor Control › Order › Change`, "Modifier / libérer l'ordre de fabrication"],
  VL10B: [`${LE} › Collective Processing of Documents Due for Delivery › Purchase Orders`, "Créer les livraisons pour les STO"],
  VA21: [`${SDM} › Sales › Quotation › Create`, "Créer l'offre client"],
  VA01: [`${SDM} › Sales › Order › Create`, "Créer la commande client"],
  VL01N: [`${LE} › Single Document › With Reference to Sales Order`, "Créer la livraison sortante"],
  VF01: [`${SDM} › Billing › Billing Document › Create`, "Créer la facture client"],
  VK11: [`${SDM} › Master Data › Conditions › Select Using Condition Type › Create`, "Créer les conditions de prix"],

  // ---------- Customizing SD ----------
  VOV8: [`${SD} › Sales › Sales Documents › Sales Document Header › Define Sales Document Types`, "Définir les types de documents de vente"],
  VOV7: [`${SD} › Sales › Sales Documents › Sales Document Item › Define Item Categories`, "Définir les catégories de poste"],
  VOV4: [`${SD} › Sales › Sales Documents › Sales Document Item › Assign Item Categories`, "Affecter les catégories de poste"],
  VTAA: [`${SD} › Sales › Sales Documents › Maintain Copy Control for Sales Documents › Copying Control: Sales Document to Sales Document`, "Contrôle de copie document de vente → document de vente"],
  "V/08": [`${SD} › Basic Functions › Pricing › Pricing Control › Define and Assign Pricing Procedures › Maintain Pricing Procedures`, "Définir la procédure de pricing"],
  OVKK: [`${SD} › Basic Functions › Pricing › Pricing Control › Define and Assign Pricing Procedures › Define Pricing Procedure Determination`, "Déterminer la procédure de pricing"],
  VKOA: [`${SD} › Basic Functions › Account Assignment/Costing › Revenue Account Determination › Assign G/L Accounts`, "Déterminer les comptes de produits (VKOA)"],
};

export function normalizeTcode(t: string): string {
  return t.trim().toUpperCase().replace(/^\/[NO]/, "");
}

export function lookupTcode(t: string): TcodeEntry | undefined {
  return TCODES[normalizeTcode(t)];
}

/** Version texte injectée dans le prompt de /api/analyze. */
export function tcodesForPrompt(): string {
  return Object.entries(TCODES)
    .map(([code, [chemin, titre]]) => `${code} = ${titre} : ${chemin}`)
    .join("\n");
}
