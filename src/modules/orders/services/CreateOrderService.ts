import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateProductService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    // busca consumer
    const customer = await this.customersRepository.findById(customer_id);
    if (!customer) {
      throw new AppError('Customer not found');
    }
    // busca produtos
    const findProducts = await this.productsRepository.findAllById(products);
    if (!findProducts) {
      throw new AppError('Products not found');
    }

    // verifica estoque do produto
    const findProductsInStock = products.every(product => {
      const findedProduct = findProducts.find(
        storedProduct => storedProduct.id === product.id,
      );
      return product.quantity < (findedProduct?.quantity || 0);
    });
    if (!findProductsInStock) {
      throw new AppError('Product not in stock');
    }

    // salva novas ordens
    const order = await this.ordersRepository.create({
      customer,
      products: products.map(product => {
        const findProduct = findProducts.find(
          storedProduct => storedProduct.id === product.id,
        );
        return {
          product_id: product.id,
          quantity: product.quantity,
          price: findProduct?.price || 0,
        };
      }),
    });

    await this.productsRepository.updateQuantity(products);

    return order;
  }
}

export default CreateProductService;
