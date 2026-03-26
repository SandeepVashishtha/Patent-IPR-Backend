const NON_PATENT_TYPES = {
  TRADEMARK: 'TRADEMARK',
  COPYRIGHT: 'COPYRIGHT',
  DESIGN: 'DESIGN',
};

const NON_PATENT_STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED'];

const NON_PATENT_TYPE_CONFIG = {
  [NON_PATENT_TYPES.TRADEMARK]: {
    code: 'TM',
    label: 'Trademark filing',
    idField: 'trademarkId',
    documentField: 'trademarkLogo',
    fields: [
      'trademarkName',
      'classOfTrademark',
      'descriptionGoodsServices',
      'usageStatus',
      'dateOfFirstUse',
      'applicantName',
      'applicantType',
      'address',
      'trademarkLogo',
    ],
    requiredFields: [
      'trademarkName',
      'classOfTrademark',
      'descriptionGoodsServices',
      'usageStatus',
      'dateOfFirstUse',
      'applicantName',
      'applicantType',
      'address',
      'trademarkLogo',
    ],
  },
  [NON_PATENT_TYPES.COPYRIGHT]: {
    code: 'CR',
    label: 'Copyright filing',
    idField: 'copyrightId',
    documentField: 'workFile',
    fields: [
      'workType',
      'titleOfWork',
      'authorDetails',
      'yearOfCreation',
      'applicantName',
      'address',
      'workFile',
    ],
    requiredFields: [
      'workType',
      'titleOfWork',
      'authorDetails',
      'yearOfCreation',
      'applicantName',
      'address',
      'workFile',
    ],
  },
  [NON_PATENT_TYPES.DESIGN]: {
    code: 'DS',
    label: 'Design filing',
    idField: 'designId',
    documentField: 'representationOfDesign',
    fields: [
      'articleName',
      'locarnoClass',
      'briefDescription',
      'applicantName',
      'address',
      'representationOfDesign',
    ],
    requiredFields: [
      'articleName',
      'locarnoClass',
      'briefDescription',
      'applicantName',
      'address',
      'representationOfDesign',
    ],
  },
};

module.exports = {
  NON_PATENT_TYPES,
  NON_PATENT_STATUSES,
  NON_PATENT_TYPE_CONFIG,
};
