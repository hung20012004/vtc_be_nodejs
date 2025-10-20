import express from 'express';
import * as LocationController from '../controllers/location.controller';

const router = express.Router();

router.get('/provinces', LocationController.getProvinces);
router.get('/districts/:provinceCode', LocationController.getDistrictsByProvince);
router.get('/wards/:districtCode', LocationController.getWardsByDistrict);

export default router;