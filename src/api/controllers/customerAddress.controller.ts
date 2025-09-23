// src/api/controllers/customerAddress.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as AddressModel from '../models/customer_address.model';

export const getCustomerAddresses = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const customerId = parseInt(req.params.customerId, 10);
        const addresses = await AddressModel.getAddressesByCustomerId(customerId);
        res.status(200).json(addresses);
    } catch (error) {
        next(error);
    }
};

export const addCustomerAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const customerId = parseInt(req.params.customerId, 10);
        const newAddress = await AddressModel.createAddress(customerId, req.body);
        res.status(201).json(newAddress);
    } catch (error) {
        next(error);
    }
};

export const updateCustomerAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const customerId = parseInt(req.params.customerId, 10);
        const addressId = parseInt(req.params.addressId, 10);
        const updatedAddress = await AddressModel.updateAddress(addressId, customerId, req.body);
        if (!updatedAddress) {
            return res.status(404).json({ message: 'Không tìm thấy địa chỉ.' });
        }
        res.status(200).json(updatedAddress);
    } catch (error) {
        next(error);
    }
};

export const deleteCustomerAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const customerId = parseInt(req.params.customerId, 10);
        const addressId = parseInt(req.params.addressId, 10);
        const success = await AddressModel.deleteAddress(addressId, customerId);
        if (!success) {
            return res.status(404).json({ message: 'Không tìm thấy địa chỉ.' });
        }
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};