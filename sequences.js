// Manœuvres en enchaînement (images dans images/).
// Chaque étape : do = ce qu'on fait (le résultat est la photo), pos = la position montrée sur la photo.
// La page en fait des cartes : photo de l'étape N -> « que fait-on ensuite ? » -> étape N+1 avec sa photo.
// Sources : fiche technique « Manoeuvre échelle à crochets » (SDIS 33, Tronc commun, 2015) ;
// « Les manœuvres de base de l'échelle à coulisse grand modèle » (DGSCGC / BMPM, © Nicolas Pereira, © SDIS 59).
const SEQUENCES = [
  {
    id: "crochets-porter",
    title: "Échelle à crochets : porter",
    steps: [
      { img: "images/crochets-01.jpg", pos: "échelle au sol, crochets au sol, 1er échelon saisi",
        do: "Saisir le 1er échelon, paume de la main vers le haut (crochets au sol)." },
      { img: "images/crochets-02.jpg", pos: "main sur le 8e échelon, crochets toujours au sol",
        do: "Remonter les échelons un à un, paume des mains vers le bas, jusqu'au 8e échelon, en laissant les crochets au sol." },
      { img: "images/crochets-03.jpg", pos: "fente avant, échelle pivotée, main sur le 10e ou 11e échelon",
        do: "Sans lâcher le 8e échelon : fente avant, faire pivoter l'échelle (crochets à l'intérieur, maintenus au sol) et saisir le 10e ou 11e échelon." },
      { img: "images/crochets-04.jpg", pos: "échelle en équilibre sur l'épaule (porter terminé)",
        do: "Se redresser et mettre l'échelle en équilibre sur l'épaule." }
    ]
  },
  {
    id: "crochets-dresser",
    title: "Échelle à crochets : dresser et monter",
    steps: [
      { img: "images/crochets-05.jpg", pos: "équipier accroupi, main sur le montant",
        do: "L'équipier s'accroupit et saisit le montant le plus près de lui, entre le 3e et le 4e échelon, paume de la main vers le bas." },
      { img: "images/crochets-06.jpg", pos: "échelle soulevée, avant-bras sous l'échelle, fente avant",
        do: "L'équipier se redresse, engage l'avant-bras sous l'échelle, en appui sur sa cuisse, en position de fente avant." },
      { img: "images/crochets-07.jpg", pos: "échelle dressée, crochets en avant",
        do: "L'équipier dresse l'échelle (crochets en avant) en 3 mouvements environ, puis saisit le bas des montants, pouces sur les montants, sans quitter les crochets du regard." },
      { img: "images/crochets-08.jpg", pos: "échelle accrochée, l'équipier la maintient au pied",
        do: "Le chef place délicatement l'échelle sur le balcon et teste le balcon, puis monte (pieds sur les échelons, mains sur les échelons contre les montants, seuls les bras travaillent). L'équipier maintient le bas des montants, bras tendus, pouces le long des montants." }
    ]
  },
  {
    id: "coulisse-mise-en-place",
    title: "Échelle à coulisse : porter, dresser, monter",
    steps: [
      { img: "images/coulisse-01.jpg", pos: "binôme debout de part et d'autre de l'échelle (chef côté parachutes)",
        do: "Le binôme se positionne dos à la direction dans laquelle il va se déplacer. Le chef se place au niveau des parachutes, le petit plan contre le sol." },
      { img: "images/coulisse-02.jpg", pos: "binôme agenouillé, mains sur les montants",
        do: "Le chef et l'équipier s'agenouillent et saisissent les montants. Ordre préparatoire du chef : « Attention pour épauler »." },
      { img: "images/coulisse-03.jpg", pos: "échelle portée à l'épaule",
        do: "Ordre exécutoire du chef : « Épauler ». Le binôme se relève en faisant demi-tour et porte l'échelle à l'épaule dans un mouvement continu." },
      { img: "images/coulisse-04.jpg", pos: "échelle posée au sol, face au point désigné",
        do: "Le binôme se présente face au point désigné par le chef d'agrès et pose l'échelle au sol (opération inverse de l'épaulement)." },
      { img: "images/coulisse-05.jpg", pos: "chef accroupi, mains en haut de l'échelle",
        do: "Le chef de binôme se saisit du haut de l'échelle par les montants." },
      { img: "images/coulisse-06.jpg", pos: "échelle soulevée, pieds en appui contre le mur",
        do: "Il fait pivoter l'échelle en effectuant un demi-tour. Il met en appui les pieds sur le mur, ou utilise l'équipier pour caler l'échelle, pour la dresser." },
      { img: "images/coulisse-07.jpg", pos: "échelle en cours de redressement",
        do: "Le chef dresse l'échelle à la verticale par rebonds successifs." },
      { img: "images/coulisse-08.jpg", pos: "échelle à la verticale, chef contre les échelons",
        do: "Le chef appose sa jambe le long des échelons et libère le trait. Trait sur l'épaule, coudes sur les montants, il libère les parachutes et déploie l'échelle." },
      { img: "images/coulisse-09.jpg", pos: "échelle déployée, parachutes bloqués, binôme au pied",
        do: "Une fois les parachutes bloqués, le chef et l'équipier débordent l'échelle de la façade." },
      { img: "images/coulisse-10.jpg", pos: "échelle débordée de la façade",
        do: "Le chef calcule ensuite le piétage d'échelle et le réajuste, si nécessaire." },
      { img: "images/coulisse-11.jpg", pos: "échelle réglée, chef en montée",
        do: "Le chef monte en cadence et sans saccades, en mouvement dissymétrique : bras droit et jambe gauche en même temps, puis bras gauche et pied droit." },
      { img: "images/coulisse-12.jpg", pos: "chef en montée",
        do: "Règle à ne jamais enfreindre : ne jamais mettre les deux pieds sur le même échelon." }
    ]
  },
  {
    id: "coulisse-reployer",
    title: "Échelle à coulisse : reployer",
    steps: [
      { img: "images/coulisse-13.jpg", pos: "échelle à la verticale, trait tiré, parachutes libérés",
        do: "Remettre l'échelle à la verticale (en appui sur le mur, ou maintenue par l'équipier sur les montants). Tirer sur le trait et l'éloigner du plan pour libérer les parachutes." },
      { img: "images/coulisse-14.jpg", pos: "échelle abaissée, calée par l'équipier",
        do: "Le chef abaisse l'échelle par rebonds successifs et l'équipier cale l'échelle avec ses pieds." },
      { img: "images/coulisse-15.jpg", pos: "échelle reployée, posée au sol",
        do: "Le chef la retourne et pose le petit plan sur le sol." }
    ]
  }
];
