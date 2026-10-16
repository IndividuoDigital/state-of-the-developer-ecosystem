// Les textes de la page en français, et ceux du widget que la page change.
// Les textes de l'enquête (titre, description, questions) viennent avec elle.

export default {
  language: "Français",
  flag: "🇫🇷",
  brand: "État de l'écosystème des développeurs Cardano",
  loading: "Chargement…",
  terms: "Conditions générales",
  source: "Code source",
  results: "Les résultats seront dans le rapport 2026. En attendant, voici",
  previous: "le rapport 2025",

  welcome: {
    until: (date) => `Ouverte jusqu'au ${date}.`,
    noWallet: "Pas besoin de portefeuille ni d'ada : nous payons les frais de transaction.",
    kept: "Vos réponses restent dans ce navigateur jusqu'à leur publication : vous pouvez vous arrêter et revenir plus tard.",
    publicTitle: "Vos réponses seront publiques",
    public:
      "Elles sont publiées sur la blockchain Cardano, où tout le monde peut les lire et où rien ne peut être modifié ni supprimé. Elles sont signées avec une clé aléatoire créée dans ce navigateur, qui n'est pas liée à vous. N'écrivez rien de personnel dans les réponses libres.",
    consent: "En publiant vos réponses, vous acceptez les",
    start: "Commencer",
    continue: "Continuer",
    restart: "Recommencer",
  },

  screened: {
    title: "Merci",
    body: "Cette enquête s'adresse aux personnes qui écrivent ou déploient des logiciels : il n'y a rien d'autre à répondre. Rien n'a été enregistré.",
    back: "Retour",
  },

  submit: {
    title: "Publier vos réponses",
    answered: (count) => (count === 1 ? "Vous avez répondu à 1 question." : `Vous avez répondu à ${count} questions.`),
    notice: "Une fois publiées, vos réponses sont publiques sur la blockchain Cardano et ne peuvent plus être modifiées ni supprimées.",
    publish: "Publier mes réponses",
    back: "Revenir à mes réponses",
    sending: "Publication…",
    retrying: (attempt) => `Publication toujours en cours… (essai ${attempt})`,
    retry: "Réessayer",
    problems: {
      busy: "Vos réponses n'ont pas pu être publiées pour l'instant. Elles sont conservées dans ce navigateur : réessayez dans une minute.",
      budget: "Le budget du jour pour les frais de transaction est épuisé. Vos réponses sont conservées dans ce navigateur : revenez demain.",
      tooLong: "Vos réponses libres sont trop longues pour être publiées. Revenez à vos réponses, raccourcissez-les et réessayez.",
      offline: "Le serveur est injoignable. Vérifiez votre connexion et réessayez.",
      check: "La vérification que vous n'êtes pas un robot a échoué. Réessayez.",
      failed: "Une erreur s'est produite, et vos réponses n'ont pas été publiées. Elles sont conservées dans ce navigateur : réessayez plus tard.",
      unpublished: "Cette enquête n'est pas encore publiée : cette page permet seulement de l'essayer, et ne peut pas publier de réponses.",
    },
  },

  thanks: {
    title: "Merci !",
    body: "Vos réponses sont publiées. Elles apparaissent sur la blockchain Cardano en moins d'une minute.",
    repeated: "Ce navigateur avait déjà publié une réponse : celles que vous venez de relire n'ont pas été publiées.",
    transaction: "Voir votre réponse sur la blockchain",
  },

  closed: {
    title: "L'enquête est terminée",
    body: "Merci à toutes les personnes qui ont répondu.",
    cancelled: "Cette enquête a été annulée et n'accepte plus de réponses.",
  },

  widget: {
    respond: {
      signAndSubmit: "Terminer",
      typeCustom: "Texte",
    },
  },
};
